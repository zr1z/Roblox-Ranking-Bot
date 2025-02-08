# Discord Roblox Bot

## Requirements
- NodeJS v18+
- Visual Studio Code or an alternative IDE
- A brain 🧠

## Terminal Setup Commands
```sh
npm i          # Installs necessary packages
node bot       # Start the bot
node bot.js    # Alternative start command
```

## Configuration
Edit the configuration variables before running the bot:

```js
const config = {
    discordToken: "Your discord bot token",
    accountCookie: "Roblox account cookie for group",
    groupId: "Group ID??"
};

const allowedRoles = {
    rankingPerms: "discordRoleId", // Role that can rank
    shoutPerms: "discordRoleId"    // Role that can send shouts
};
```
