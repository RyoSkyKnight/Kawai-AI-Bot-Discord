const { EmbedBuilder } = require('discord.js');
const { chatCompletion } = require('../../services/aiClient');

module.exports = {
  data: {
    name: 'translate',
    description: 'Translate text using AI',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text to translate',
        required: true
      },
      {
        name: 'language',
        type: 3,
        description: 'Target language (e.g., English, Indonesian, Japanese)',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const language = interaction.options.getString('language');

    await interaction.deferReply();

    try {
      const responseMessage = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text to ${language}. Output ONLY the translated text itself without any introduction, explanations, quotes, or formatting.`
          },
          {
            role: 'user',
            content: text
          }
        ]
      });

      const translation = responseMessage.content || '';

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🌐 Translation')
        .addFields(
          { name: 'Original', value: text },
          { name: `Translated to ${language}`, value: translation }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Translation error:', error);
      await interaction.editReply({ content: '❌ An error occurred during translation.' });
    }
  }
};
