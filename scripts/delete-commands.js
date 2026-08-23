const { REST, Routes } = require('discord.js');
const { BOT_TOKEN, CLIENT_ID } = require('../src/config');

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('Started deleting commands.');

    const commands = await rest.get(
      Routes.applicationCommands(CLIENT_ID)
    );

    for (const command of commands) {
      await rest.delete(
        Routes.applicationCommand(CLIENT_ID, command.id)
      );
      console.log(`Deleted command ${command.name}`);
    }

    console.log('Successfully deleted all commands.');
  } catch (error) {
    console.error(error);
  }
})();
