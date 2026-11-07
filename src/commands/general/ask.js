const state = require('../../state');
const { processAiChat, getEffectivePersonality } = require('../../services/aiChatService');
const { sendModernAiResponse, createThinkingEmbed } = require('../../utils/aiResponseHelper');

module.exports = {
  data: {
    name: 'ask',
    description: 'Ask a question to Cutie AI with modern interactive responses',
    options: [
      {
        name: 'question',
        type: 3,
        description: 'The question you want to ask the bot',
        required: true,
      }
    ]
  },
  async execute(interaction) {
    const prompt = interaction.options.getString('question');
    const userId = interaction.user.id;

    if (state.activeAskUsers.has(userId)) {
      await interaction.reply({
        content: 'You already have a question being processed. Please wait a moment.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    if (interaction.channel) {
      interaction.channel.sendTyping().catch(() => {});
    }

    state.activeAskUsers.add(userId);

    try {
      const pInfo = await getEffectivePersonality(userId, interaction.guild?.id);
      await interaction.editReply({ embeds: [createThinkingEmbed(pInfo)] }).catch(() => {});

      const executeAi = async () => {
        return await processAiChat({
          prompt,
          user: interaction.user,
          member: interaction.member,
          guild: interaction.guild,
          channel: interaction.channel,
          client: interaction.client,
          interaction,
        });
      };

      const aiResult = await executeAi();

      await sendModernAiResponse({
        target: interaction,
        user: interaction.user,
        prompt,
        aiResult,
      });
    } catch (error) {
      console.error('Error generating response in /ask:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'An error occurred while processing your request. Please try again.' }).catch(() => {});
      } else {
        await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true }).catch(() => {});
      }
    } finally {
      state.activeAskUsers.delete(userId);
    }
  }
};
