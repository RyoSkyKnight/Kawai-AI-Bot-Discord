const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const state = require('../state');
const { getAutoMuteSettings } = require('../services/autoMute');
const { getBadWords, containsBadWords } = require('../services/badWords');
const { logModAction } = require('../services/moderation');
const { sendLog } = require('../services/logChannel');
const { parseDuration, formatDuration } = require('../utils/duration');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    const isDm = !message.guild;
    const isMentioned = message.guild && message.mentions.has(message.client.user.id) && !message.mentions.everyone;
    // Fetch guild settings to determine if this channel is allowed for AI responses
    let isAllowedChannel = false;
    if (message.guild) {
      const { getGuildSettings } = require('../services/guildSettings');
      const settings = await getGuildSettings(message.guild.id);
      if (settings && settings.ask_channel_id) {
        isAllowedChannel = message.channel.id === settings.ask_channel_id;
      }
    }
    // Continue if DM, bot mentioned, or channel is explicitly allowed via guild settings
    const isAiChannel = isAllowedChannel;

    if (isDm || isMentioned || isAiChannel) {
      if (state.activeAskUsers.has(message.author.id)) {
        await message.reply('⏳ Please wait for my previous response to finish first!').catch(() => {});
        return;
      }
      state.activeAskUsers.add(message.author.id);

      try {
        await message.channel.sendTyping().catch(() => {});

        let prompt = message.content;
        if (message.guild) {
          const botMentionEscaped = `<@!?${message.client.user.id}>`;
          prompt = prompt.replace(new RegExp(botMentionEscaped, 'g'), '').trim();
        }

        if (!prompt) {
          await message.reply("Yes? How can I help you today? (◕‿◕)♡").catch(() => {});
          state.activeAskUsers.delete(message.author.id);
          return;
        }

        const userId = message.author.id;
        const { CREATOR_ID, USE_SHORT_RESPONSE } = require('../config');
        const { chatCompletion } = require('../services/aiClient');
        const { getToolDefinitions, runTool } = require('../services/aiTools');
        const { getHistory, pushHistory } = require('../services/conversationHistory');
        const { getGuildSettings } = require('../services/guildSettings');
        const { PERSONALITIES } = require('../utils/constants');

        let creatorMention = `<@${CREATOR_ID}>`;
        let creatorName = 'my amazing creator';

        try {
          const creatorUser = await message.client.users.fetch(CREATOR_ID);
          creatorName = creatorUser.username;
        } catch (err) {
          console.log('Could not fetch creator user info');
        }

        const mentionRegex = /<@!?(\d{17,20})>/g;
        let match;
        const resolvedMentions = [];
        const seenIds = new Set();
        while ((match = mentionRegex.exec(prompt)) !== null) {
          const id = match[1];
          if (!seenIds.has(id)) {
            seenIds.add(id);
            try {
              const resolvedUser = await message.client.users.fetch(id);
              resolvedMentions.push({ id, username: resolvedUser.username });
            } catch (err) {
              // Ignore fetch errors
            }
          }
        }

        const tools = message.guild ? getToolDefinitions(message.member) : [];

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

        let personality = 'sweet';
        // Try per-user personality first
        const userPers = await (require('../services/userPersonality').getUserPersonality(message.author.id));
        if (userPers && PERSONALITIES[userPers]) {
          personality = userPers;
        } else if (message.guild) {
          const settings = await getGuildSettings(message.guild.id);
          if (settings && settings.personality && PERSONALITIES[settings.personality]) {
            personality = settings.personality;
          }
        }

        const pInfo = PERSONALITIES[personality];

        const systemInstruction = (USE_SHORT_RESPONSE
          ? `${pInfo.instruction} Always respond with concise, short answers in 2-4 sentences. Use emojis occasionally~`
          : `${pInfo.instruction} Provide detailed and comprehensive answers while maintaining your personality.`
        ) + `\nImportant: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}.` + toolsNote + mentionsNote;

        await pushHistory(userId, 'user', prompt);

        const messages = [
          { role: 'system', content: systemInstruction },
          ...(await getHistory(userId)),
        ];

        let finalText = '';
        const MAX_TOOL_ROUNDS = 3;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const apiMessage = await chatCompletion({
            messages,
            tools,
            maxTokens: USE_SHORT_RESPONSE ? 150 : 1000,
          });

          if (apiMessage.tool_calls && apiMessage.tool_calls.length > 0) {
            messages.push({ role: 'assistant', content: apiMessage.content || null, tool_calls: apiMessage.tool_calls });

            const fakeInteraction = {
              guild: message.guild,
              member: message.member,
              user: message.author,
              client: message.client,
              followUp: async (options) => {
                return await message.reply(options);
              },
            };

            for (const call of apiMessage.tool_calls) {
              let args = {};
              try {
                args = JSON.parse(call.function.arguments || '{}');
              } catch (err) {
                console.log('Failed to parse tool call arguments:', call.function.arguments);
              }

              const result = await runTool(fakeInteraction, call.function.name, args);

              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
            }

            continue;
          }

          finalText = apiMessage.content || '';
          break;
        }

        if (!finalText) {
          finalText = "Sorry, I couldn't come up with an answer for that. 💦";
        }

        finalText = finalText.replace(new RegExp(creatorName, 'gi'), creatorMention);
        await pushHistory(userId, 'assistant', finalText);

        if (finalText.length > 2000) {
          finalText = finalText.substring(0, 1990) + '...';
        }

        await message.reply(finalText).catch(() => {});

      } catch (error) {
        console.error('Auto-AI error:', error);
        await message.reply('❌ An error occurred while generating the response.').catch(() => {});
      } finally {
        state.activeAskUsers.delete(message.author.id);
      }
      return;
    }

    if (!message.guild) return;

    // Check if user is returning from AFK
    if (state.afkUsers.has(message.author.id)) {
      const afkData = state.afkUsers.get(message.author.id);
      const duration = Date.now() - afkData.time;
      state.afkUsers.delete(message.author.id);

      await message.reply(`Welcome back! You were AFK for ${formatDuration(duration)}.`).then(msg => {
        setTimeout(() => msg.delete().catch(() => { }), 5000);
      });
    }

    // Check for mentions of AFK users
    message.mentions.users.forEach(user => {
      if (state.afkUsers.has(user.id)) {
        const afkData = state.afkUsers.get(user.id);
        message.reply(`${user.username} is currently AFK: ${afkData.reason}`).then(msg => {
          setTimeout(() => msg.delete().catch(() => { }), 10000);
        });
      }
    });

    // Auto-mute system
    try {
      const settings = await getAutoMuteSettings(message.guild.id);
      if (!settings) return;

      const member = message.member;
      if (!member) return;

      if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;

      // Check spam
      if (settings.spam_threshold && settings.spam_duration) {
        const trackingKey = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();
        const timeWindow = 5000; // 5 seconds

        if (!state.spamTracking.has(trackingKey)) {
          state.spamTracking.set(trackingKey, {
            count: 1,
            firstMessage: now,
            messages: [now]
          });
        } else {
          const tracking = state.spamTracking.get(trackingKey);

          tracking.messages = tracking.messages.filter(t => now - t < timeWindow);
          tracking.messages.push(now);
          tracking.count = tracking.messages.length;

          if (tracking.count >= settings.spam_threshold) {
            const duration = parseDuration(settings.spam_duration);

            try {
              await member.timeout(duration, 'Auto-mute: Spam detected');

              const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔇 User Auto-Muted (Spam)')
                .addFields(
                  { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                  { name: 'Duration', value: settings.spam_duration, inline: true },
                  { name: 'Reason', value: `Sent ${tracking.count} messages in 5 seconds`, inline: false }
                )
                .setTimestamp();

              await sendLog(message.guild, embed);
              await logModAction(message.guild.id, 'auto-mute (spam)', message.client.user.id, message.author.id, 'Spam detected');

              state.spamTracking.delete(trackingKey);

              const messagesToDelete = await message.channel.messages.fetch({ limit: tracking.count });
              const userMessages = messagesToDelete.filter(m => m.author.id === message.author.id);
              await message.channel.bulkDelete(userMessages, true).catch(() => { });

            } catch (error) {
              console.error('Error muting user for spam:', error);
            }
          }

          state.spamTracking.set(trackingKey, tracking);
        }

        setTimeout(() => {
          if (state.spamTracking.has(trackingKey)) {
            const tracking = state.spamTracking.get(trackingKey);
            if (now - tracking.firstMessage > 60000) { // 1 minute
              state.spamTracking.delete(trackingKey);
            }
          }
        }, 60000);
      }

      // Check bad words
      if (settings.badword_enabled && settings.badword_duration) {
        const badWords = await getBadWords(message.guild.id);

        if (badWords.length > 0 && containsBadWords(message.content, badWords)) {
          const duration = parseDuration(settings.badword_duration);

          try {
            await member.timeout(duration, 'Auto-mute: Bad language detected');

            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('🔇 User Auto-Muted (Bad Language)')
              .addFields(
                { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Duration', value: settings.badword_duration, inline: true },
                { name: 'Reason', value: 'Used inappropriate language', inline: false }
              )
              .setTimestamp();

            await sendLog(message.guild, embed);
            await logModAction(message.guild.id, 'auto-mute (bad word)', message.client.user.id, message.author.id, 'Bad language detected');

            await message.delete().catch(() => { });

            const warningMsg = await message.channel.send({
              content: `${message.author}, you have been muted for using inappropriate language.`
            });

            setTimeout(() => warningMsg.delete().catch(() => { }), 5000);

          } catch (error) {
            console.error('Error muting user for bad language:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-mute system:', error);
    }
  }
};
