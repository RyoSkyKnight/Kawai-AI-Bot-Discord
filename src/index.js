const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { BOT_TOKEN } = require('./config');

// Prevent unexpected process exits on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
for (const category of fs.readdirSync(commandsDir)) {
  const categoryDir = path.join(commandsDir, category);
  if (!fs.statSync(categoryDir).isDirectory()) continue;

  for (const file of fs.readdirSync(categoryDir).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(categoryDir, file));
    if (command?.data?.name) {
      client.commands.set(command.data.name, command);
    }
  }
}

const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.login(BOT_TOKEN);

