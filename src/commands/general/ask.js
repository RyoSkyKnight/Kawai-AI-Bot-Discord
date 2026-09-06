const { EmbedBuilder } = require('discord.js');
const state = require('../../state');
const { randomColor } = require('../../utils/constants');
const { processAiChat } = require('../../services/aiChatService');

module.exports = {
  data: {
    name: 'ask',
    description: 'Ask a question to the bot powered by OpenRouter AI',
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
      await interaction.reply({ content: '⏳ You already have a question being processed, please wait for it to finish.', ephemeral: true });
      return;
    }

    await interaction.deferReply();
    if (interaction.channel) {
      interaction.channel.sendTyping().catch(() => {});
    }

    state.activeAskUsers.add(userId);

    try {
      const finalText = await processAiChat({
        prompt,
        user: interaction.user,
        member: interaction.member,
        guild: interaction.guild,
        channel: interaction.channel,
        client: interaction.client,
        interaction,
      });

      const responseEmbed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle('💖 Response from Cutie')
        .setDescription(`**Question:** ${prompt}\n\n**Answer:**\n${finalText}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error generating response:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ An error occurred while generating the response.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while generating the response.', ephemeral: true });
      }
    } finally {
      state.activeAskUsers.delete(userId);
    }
  }
};

