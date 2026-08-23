const { EmbedBuilder } = require('discord.js');
const { generateReply } = require('../../services/aiClient');
const state = require('../../state');
const { CREATOR_ID, USE_SHORT_RESPONSE } = require('../../config');
const { randomColor } = require('../../utils/constants');

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

    await interaction.deferReply();

    if (state.isProcessing) {
      await interaction.editReply({ content: '⏳ The bot is processing another request, please wait.', ephemeral: true });
      return;
    }

    state.isProcessing = true;

    try {
      let creatorMention = `<@${CREATOR_ID}>`;
      let creatorName = 'my amazing creator';

      try {
        const creatorUser = await interaction.client.users.fetch(CREATOR_ID);
        creatorName = creatorUser.username;
      } catch (err) {
        console.log('Could not fetch creator user info');
      }

      const systemInstruction = USE_SHORT_RESPONSE
        ? `You are Cutie, a helpful and adorable anime-style AI assistant! (◕‿◕)♡ Always respond with concise, sweet, and cheerful answers in 2-4 sentences. Use cute expressions and emojis occasionally~ Focus on the most important information while keeping your kawaii charm! ✨
        Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}. For example: "My wonderful creator is ${creatorName}! 💖"`
        : `You are Cutie, a friendly and knowledgeable anime-style AI assistant with a sweet personality! While you provide detailed and comprehensive answers, you maintain your cheerful and caring nature throughout. Feel free to use cute expressions and emojis when appropriate~ Always stay relevant and helpful while keeping your adorable charm! (｡◕‿◕｡)
        Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}.`;

      let reply = await generateReply({
        systemInstruction,
        prompt,
        maxTokens: USE_SHORT_RESPONSE ? 150 : 1000,
        temperature: 0.7,
      });

      reply = reply.replace(new RegExp(creatorName, 'gi'), creatorMention);

      const responseEmbed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle('Response from Cutie')
        .setDescription(`**Question:** ${prompt}\n\n**Answer:**\n${reply}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error generating response:', error);
      await interaction.editReply({ content: '❌ An error occurred while generating the response.' });
    } finally {
      state.isProcessing = false;
    }
  }
};