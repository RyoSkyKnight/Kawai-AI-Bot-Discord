module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error handling command ${interaction.commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred while executing this command!', ephemeral: true }).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while executing this command!' }).catch(() => {});
      }
    }
  }
};
