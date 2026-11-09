const { EmbedBuilder } = require('discord.js');
const { clearHistory } = require('../../services/conversationHistory');
const { getEffectivePersonality } = require('../../services/aiChatService');

module.exports = {
  data: {
    name: 'clearhistory',
    description: 'Clear your AI chat conversation history with Cutie',
  },
  async execute(interaction) {
    try {
      await clearHistory(interaction.user.id);
      const pInfo = await getEffectivePersonality(interaction.user.id, interaction.guild?.id).catch(() => null);
      const color = pInfo?.color || '#FF69B4';
      const kaomoji = pInfo?.kaomoji || '*(◕‿◕)♡*';

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🌸 Conversation History Reset')
        .setDescription(`Your conversation memory with Cutie has been cleared, Master!\nNext time we talk, we'll start with a brand new, fresh context. ${kaomoji}`)
        .setFooter({ text: 'Cutie AI • Memory Reset' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      await interaction.reply({
        content: 'Failed to clear conversation history. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
