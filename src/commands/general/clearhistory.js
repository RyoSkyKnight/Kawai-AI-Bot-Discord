const { EmbedBuilder } = require('discord.js');
const { clearHistory } = require('../../services/conversationHistory');
const { randomColor } = require('../../utils/constants');

module.exports = {
  data: {
    name: 'clearhistory',
    description: 'Clear your AI chat conversation history with the bot',
  },
  async execute(interaction) {
    try {
      await clearHistory(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle('🧹 History Cleared!')
        .setDescription('Your AI conversation history has been reset! From our next chat, we will start with a fresh memory. ✨')
        .setFooter({ text: 'Kawai AI Bot' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      await interaction.reply({
        content: '❌ Failed to clear conversation history. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
