const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { BOT_TOKEN, CLIENT_ID } = require('../src/config');

const commandsDir = path.join(__dirname, '..', 'src', 'commands');
const commands = [];

for (const category of fs.readdirSync(commandsDir)) {
  const categoryDir = path.join(commandsDir, category);
  for (const file of fs.readdirSync(categoryDir).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(categoryDir, file));
    commands.push(command.data);
  }
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ Successfully reloaded ${commands.length} application (/) commands globally.`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();
