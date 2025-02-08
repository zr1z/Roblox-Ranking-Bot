const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActivityType, Collection } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs');
const os = require('os');
const osUtils = require('os-utils');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { discordToken, robloxCookie, groupId } = config;

const indexClient = new Client({
    failIfNotExists: false,
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions ],
});

const allowedRoles = {
    rankingPerms: 'discordRoleId', 
    shoutPerms: 'discordRoleId'
};

const commandsList = {
    'accept': 'Accept a user that is pending to join the group.',
    'exile': 'Exile a user from the group.',
    'set-rank': 'Set the rank of a user within the group.',
    'promote': 'Promote a user within the group.',
    'demote': 'Demote a user within the group.',
    'shout': 'Post a shout to the groups home page.',
    'lookup': 'Lookup a users details in the group.',
    'test': 'Test command for checking the bot.'
};

const commands = [
    {
        name: 'accept',
        description: 'Accept a user that is pending to join the group.',
        options: [{ name: 'username', type: 3, description: 'Provide a username', required: true }],
    },
    {
        name: 'exile',
        description: 'Exile a user from the group',
        options: [{ name: 'username', type: 3, description: 'Provide the username', required: true }],
    },
    {
        name: 'set-rank',
        description: 'Set the rank of a user within the group.',
        options: [{ name: 'username', type: 3, description: 'Provide the username', required: true },
        { name: 'role', type: 3, description: 'Provide the role name', required: true },],
    },
    {
        name: 'promote',
        description: 'Promote a user within the group.',
        options: [{ name: 'username', type: 3, description: 'Provide a username', required: true }],
    },
    {
        name: 'demote',
        description: 'Demote a user within the group.',
        options: [{ name: 'username', type: 3, description: 'Provide a username', required: true }],
    },
    {
        name: 'shout',
        description: 'Post a shout to the group\'s home page.',
        options: [{ name: 'message', type: 3, description: 'Enter the text message', required: true }],
    },
    {
        name: 'lookup',
        description: 'Lookup a user\'s details in the group.',
        options: [{ name: 'username', type: 3, description: 'Provide the username', required: true }],
    },
    {
        name: 'help',
        description: 'Get a list of the bot commands.',
    },
    {
        name: 'test',
        description: 'Test command for checking the bot.',
    },
    {
        name: 'botinfo',
        description: 'shows the bots information.',
    }
];

const cooldowns = new Collection();

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(discordToken);
    try {
        console.log('Loading the bot commands (/)');
        await rest.put(Routes.applicationCommands(indexClient.user.id), { body: commands });
        console.log('Commands loaded (/)');
    } catch (error) {
        console.error(error);
    }
}

async function getAvatarUrl(username) {
    try {
        const userId = await noblox.getIdFromUsername(username);
        const thumbnailData = await noblox.getPlayerThumbnail([userId], "150x150", "png", true);
        if (thumbnailData.length > 0) {
            return thumbnailData[0].imageUrl;
        }
    } catch (error) {
        console.error('Failed to get avatar URL:', error);
    }
    return null;
}

indexClient.once('ready', async () => {
    console.log(`Logged in as ${indexClient.user.tag}`);
    indexClient.user.setStatus("dnd");
    indexClient.user.setActivity("Ranking Bot Handler", { type: ActivityType.Playing });

    await registerCommands();

    try {
        await noblox.setCookie(robloxCookie);
        console.log('Logged into Roblox Account!');
    } catch (err) {
        console.error('Failed to login:', err);
    }
});

indexClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, member } = interaction;
    const now = Date.now();
    const timestamps = cooldowns.get(commandName);
    const cooldownAmount = (10) * 1000;

    if (timestamps) {
        if (timestamps.has(member.id)) {
        const expirationTime = timestamps.get(member.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = Math.floor((expirationTime - now) / 1000);
            const cooldownEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Cooldown Alert')
                .setDescription(`Please wait ${timeLeft} more seconds before using the \`${commandName}\` command again.`);
            await interaction.reply({ embeds: [cooldownEmbed], ephemeral: false });
            return;
        }
    }

    timestamps.set(member.id, now);
    setTimeout(() => timestamps.delete(member.id), cooldownAmount);
} else {
    cooldowns.set(commandName, new Collection());
    cooldowns.get(commandName).set(member.id, now);
}

const hasRole = (roleId) => member.roles.cache.has(roleId);

if (['set-rank', 'exile', 'promote', 'demote', 'accept', 'lookup'].includes(commandName)) {
    if (!hasRole(allowedRoles.rankingPerms)) {
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Error')
            .setDescription('You do not have permission to use this command.');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: false });
        return;
    }
}

if (commandName === 'shout') {
    if (!hasRole(allowedRoles.shoutPerms)) {
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Error')
            .setDescription('You do not have permission to use this command.');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: false });
        return;
    }
}

try {
    if (commandName === 'set-rank') {
        const username = options.getString('username');
        const roleName = options.getString('role');

        const userId = await noblox.getIdFromUsername(username);
        const roles = await noblox.getRoles(groupId);
        const role = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());

        if (!role) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Error')
                .setDescription(`Role "${roleName}" does not exist in the group.`);
            await interaction.reply({ embeds: [errorEmbed] });
            return;
        }

        await noblox.setRank(groupId, userId, role.rank);
        const avatarUrl = await getAvatarUrl(username);

        const successEmbed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('User Successfully Ranked:')
            .setDescription(`**User:** ${username}`)
            .setThumbnail(avatarUrl)
            .addFields(
                { name: 'User ID', value: `${userId}`, inline: true },
                { name: 'Role Name', value: `${role.name}`, inline: true },
                { name: 'Profile Link', value: `[Profile](https://roblox.com/users/${userId}/profile)`, inline: false }
            );

        await interaction.reply({ embeds: [successEmbed] });
    }

        if (commandName === 'exile') {
            const username = options.getString('username');
            const userId = await noblox.getIdFromUsername(username);
            await noblox.exile(groupId, userId);
            const avatarUrl = await getAvatarUrl(username);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('User Successfully Exiled:')
                .setDescription(`**User:** ${username}`)
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'User ID', value: `${userId}`, inline: true },
                    { name: 'Profile Link', value: `[Profile](https://roblox.com/users/${userId}/profile)`, inline: false }
                );

            await interaction.reply({ embeds: [successEmbed] });
        }

        if (commandName === 'promote') {
            const username = options.getString('username');
            const userId = await noblox.getIdFromUsername(username);
            const newRank = await noblox.promote(groupId, userId);
            const newRoleName = await noblox.getRankNameInGroup(groupId, userId);
            const avatarUrl = await getAvatarUrl(username);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('User Successfully Promoted:')
                .setDescription(`**User:** ${username}`)
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'User ID', value: `${userId}`, inline: true },
                    { name: 'New Role', value: `${newRoleName}`, inline: true },
                    { name: 'Profile Link', value: `[Profile](https://roblox.com/users/${userId}/profile)`, inline: false }
                );

            await interaction.reply({ embeds: [successEmbed] });
        }

        if (commandName === 'demote') {
            const username = options.getString('username');

            const userId = await noblox.getIdFromUsername(username);
            const userRank = await noblox.getRankInGroup(groupId, userId);
            const roles = await noblox.getRoles(groupId);
            const currentRole = roles.find(role => role.rank === userRank);
            const previousRole = roles.find(role => role.rank === userRank - 1);

            if (!previousRole) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Error')
                    .setDescription('User is already at the lowest rank or no previous rank found.');
                await interaction.reply({ embeds: [errorEmbed] });
                return;
            }

            await noblox.setRank(groupId, userId, previousRole.rank);
            const avatarUrl = await getAvatarUrl(username);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('User Successfully Demoted:')
                .setDescription(`**User:** ${username}`)
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'User ID', value: `${userId}`, inline: true },
                    { name: 'New Role', value: `${previousRole.name}`, inline: true },
                    { name: 'Profile Link', value: `[Profile](https://roblox.com/users/${userId}/profile)`, inline: false }
                );

            await interaction.reply({ embeds: [successEmbed] });
        }

        if (commandName === 'accept') {
            const username = options.getString('username');

            const userId = await noblox.getIdFromUsername(username);
            const joinRequestsResponse = await noblox.getJoinRequests(groupId);
            const joinRequests = joinRequestsResponse.data;

            const request = joinRequests.find(req => req.requester.userId === userId);

            if (!request) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Error')
                    .setDescription(`No join request found for **${username}**.`);
                await interaction.reply({ embeds: [errorEmbed] });
                return;
            }

            await noblox.handleJoinRequest(groupId, request.requester.userId, 'Accept');

            const avatarUrl = await getAvatarUrl(username);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('User Successfully Accepted:')
                .setDescription(`**User:** ${username}`)
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'User ID', value: `${userId}`, inline: true },
                    { name: 'Profile Link', value: `[Profile](https://roblox.com/users/${userId}/profile)`, inline: false }
                );

            await interaction.reply({ embeds: [successEmbed] });
        }

        if (commandName === 'shout') {
            const message = options.getString('message');
            await noblox.shout(groupId, message);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('Shout Successfully Posted:')
                .setDescription(`**Message:** ${message}`);

            await interaction.reply({ embeds: [successEmbed] });
        }

        if (commandName === 'lookup') {
            const username = options.getString('username');

            try {
                const userId = await noblox.getIdFromUsername(username);
                const userRank = await noblox.getRankInGroup(groupId, userId);
                const rankName = await noblox.getRankNameInGroup(groupId, userId);
                const avatarUrl = await getAvatarUrl(username);

                const successEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('User Lookup Details:')
                    .setDescription(`**User:** ${username}`)
                    .setThumbnail(avatarUrl)
                    .addFields(
                        { name: 'User ID', value: `${userId}`, inline: true },
                        { name: 'Rank', value: `${rankName}`, inline: true },
                        { name: 'Profile Link', value: `[Profile](https://roblox.com/users/${userId}/profile)`, inline: true }
                    );

                await interaction.reply({ embeds: [successEmbed] });
            } catch (error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Error')
                    .setDescription(`Failed to lookup user. ${error.message}`);

                await interaction.reply({ embeds: [errorEmbed] });
            }
        }

        if (commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('Commands List')
                .addFields(
                    ...Object.entries(commandsList).map(([command, description]) => ({
                        name: `\`${command}\``,
                        value: description,
                        inline: false
                    }))
                );

            await interaction.reply({ embeds: [helpEmbed] });
        }

        if (commandName === 'test') {
            const testEmbed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('Test Command')
                .setDescription('This is a test command to check if the bot is functioning properly.');

            await interaction.reply({ embeds: [testEmbed] });
        }
    } catch (error) {
        console.error('Error handling command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Error')
            .setDescription('An error occurred while processing the command.');
        await interaction.reply({ embeds: [errorEmbed] });
    }

    if (commandName === 'botinfo') {
        try {
            const ping = indexClient.ws.ping; 
            const uptime = os.uptime(); 
            const totalMemory = osUtils.totalmem(); 
            const freeMemory = osUtils.freemem();
    
            osUtils.cpuUsage(async (cpuUsage) => {
                const cpuUsagePercent = (cpuUsage * 100).toFixed(2);
    
                const botInfoEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('Bot Information')
                    .addFields(
                        { name: 'Ping', value: `${ping}ms`, inline: true },
                        { name: 'CPU Usage', value: `${cpuUsagePercent}%`, inline: true },
                        { name: 'Total Memory', value: `${totalMemory.toFixed(2)} MB`, inline: true },
                        { name: 'Free Memory', value: `${freeMemory.toFixed(2)} MB`, inline: true },
                        { name: 'System Uptime', value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true },
                        { name: 'Operating System', value: `${os.type()} ${os.arch()}`, inline: true },
                        { name: 'CPU Cores', value: `${os.cpus().length}`, inline: true },
                    );
    
                await interaction.reply({ embeds: [botInfoEmbed] });
            });
        } catch (error) {
            console.error('Error handling botinfo command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Error')
                .setDescription('An error occurred while fetching bot information.');
            await interaction.reply({ embeds: [errorEmbed] });
        }
    } 
});

indexClient.login(discordToken);
