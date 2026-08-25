
const { EmbedBuilder } = require('discord.js');
const { chatCompletion } = require('../../services/aiClient');
const { getToolDefinitions, runTool } = require('../../services/aiTools');
const { getHistory, pushHistory } = require('../../services/conversationHistory');
const state = require('../../state');
const { CREATOR_ID, USE_SHORT_RESPONSE } = require('../../config');
const { randomColor } = require('../../utils/constants');

const MAX_TOOL_ROUNDS = 3; // safety cap on tool-call <-> model round-trips

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

    await interaction.deferReply();

    // Per-user lock, not global — one user's /ask no longer blocks everyone else's.
    if (state.activeAskUsers.has(userId)) {
      await interaction.editReply({ content: '⏳ You already have a question being processed, please wait for it to finish.' });
      return;
    }
    state.activeAskUsers.add(userId);

    try {
      let creatorMention = `<@${CREATOR_ID}>`;
      let creatorName = 'my amazing creator';

      try {
        const creatorUser = await interaction.client.users.fetch(CREATOR_ID);
        creatorName = creatorUser.username;
      } catch (err) {
        console.log('Could not fetch creator user info');
      }

      // Parse and fetch user mentions in the prompt to resolve their IDs to usernames for the AI
      const mentionRegex = /<@!?(\d{17,20})>/g;
      let match;
      const resolvedMentions = [];
      const seenIds = new Set();
      while ((match = mentionRegex.exec(prompt)) !== null) {
        const id = match[1];
        if (!seenIds.has(id)) {
          seenIds.add(id);
          try {
            const resolvedUser = await interaction.client.users.fetch(id);
            resolvedMentions.push({ id, username: resolvedUser.username });
          } catch (err) {
            // Ignore fetch errors
          }
        }
      }

      // Tools are only offered inside a server (moderation actions make no sense in DMs).
      const tools = interaction.guild ? getToolDefinitions(interaction.member) : [];

      const toolsListStr = tools.map((t) => t.function.name).join(', ');
      const toolsNote = tools.length > 0
        ? `\n\nYou also have access to helper/moderation tools for this Discord server (${toolsListStr}). Only call a tool if the user clearly asks you to take that action — never call one speculatively. Every tool call is independently permission-checked server-side against the requesting user's real Discord permissions and role hierarchy, so if they lack permission the tool will refuse; when that happens, relay the refusal honestly and never claim an action succeeded if the tool result says it didn't. To target a user, use the numeric Discord ID from a mention like <@123456789012345678>; if the user didn't @mention anyone, ask them to before assuming who they mean.`
        : '';

      let mentionsNote = '';
      if (resolvedMentions.length > 0) {
        mentionsNote = `\n\nResolved user mentions in this query:\n` +
          resolvedMentions.map(m => `- User <@${m.id}> has username "${m.username}" (ID: ${m.id})`).join('\n') +
          `\nAlways use the exact mention format <@USER_ID> (for example, <@${resolvedMentions[0].id}>) in your response if you want to tag or refer to them. Do NOT convert mentions to plain text like "@username".`;
      }

      const systemInstruction = (USE_SHORT_RESPONSE
        ? `You are Cutie, a helpful and adorable anime-style AI assistant! (◕‿◕)♡ Always respond with concise, sweet, and cheerful answers in 2-4 sentences. Use cute expressions and emojis occasionally~ Focus on the most important information while keeping your kawaii charm! ✨
        Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}. For example: "My wonderful creator is ${creatorName}! 💖"`
        : `You are Cutie, a friendly and knowledgeable anime-style AI assistant with a sweet personality! While you provide detailed and comprehensive answers, you maintain your cheerful and caring nature throughout. Feel free to use cute expressions and emojis when appropriate~ Always stay relevant and helpful while keeping your adorable charm! (｡◕‿◕｡)
        Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}.`
      ) + toolsNote + mentionsNote;

      // Per-user session memory, persisted in Supabase: remember recent turns for this user only.
      await pushHistory(userId, 'user', prompt);

      const messages = [
        { role: 'system', content: systemInstruction },
        ...(await getHistory(userId)),
      ];

      let finalText = '';

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const message = await chatCompletion({
          messages,
          tools,
          maxTokens: USE_SHORT_RESPONSE ? 150 : 1000,
        });

        if (message.tool_calls && message.tool_calls.length > 0) {
          messages.push({ role: 'assistant', content: message.content || null, tool_calls: message.tool_calls });

          for (const call of message.tool_calls) {
            let args = {};
            try {
              args = JSON.parse(call.function.arguments || '{}');
            } catch (err) {
              console.log('Failed to parse tool call arguments:', call.function.arguments);
            }

            // Permission + hierarchy checks happen inside runTool, regardless
            // of what the model decided — this is the real security boundary.
            const result = await runTool(interaction, call.function.name, args);

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          }

          continue; // feed tool results back to the model for its next turn
        }

        finalText = message.content || '';
        break;
      }

      if (!finalText) {
        finalText = "Sorry, I couldn't come up with an answer for that. 💦";
      }

      finalText = finalText.replace(new RegExp(escapeRegExp(creatorName), 'gi'), creatorMention);
      await pushHistory(userId, 'assistant', finalText);

      const responseEmbed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle('💖 Response from Cutie')
        .setDescription(`**Question:** ${prompt}\n\n**Answer:**\n${finalText}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error generating response:', error);
      await interaction.editReply({ content: '❌ An error occurred while generating the response.' });
    } finally {
      state.activeAskUsers.delete(userId);
    }
  }
};
