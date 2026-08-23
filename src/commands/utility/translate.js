const { EmbedBuilder } = require('discord.js');
const genAI = require('../../services/aiClient');
const state = require('../../state');

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

    if (state.isProcessing) {
      await interaction.reply({ content: '⏳ The bot is processing another request, please wait.', ephemeral: true });
      return;
    }

    state.isProcessing = true;
    await interaction.deferReply();

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `Translate the following text to ${language}. Only provide the translation, no explanations:\n\n${text}`;

      const result = await model.generateContent(prompt);
      const translation = result.response.text();

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
      await interaction.editReply({ content: '❌ An error occurred during translation.' });
    } finally {
      state.isProcessing = false;
    }
  }
};
