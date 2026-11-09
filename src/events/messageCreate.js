const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const state = require('../state');
const { getGuildSettings } = require('../services/guildSettings');
const { getAutoMuteSettings } = require('../services/autoMute');
const { getBadWords, containsBadWords } = require('../services/badWords');
const { logModAction } = require('../services/moderation');
const { sendLog } = require('../services/logChannel');
const { parseDuration, formatDuration } = require('../utils/duration');
const { processAiChat, getEffectivePersonality } = require('../services/aiChatService');
const { sendModernAiResponse, createThinkingEmbed } = require('../utils/aiResponseHelper');

const DISCORD_INVITE_REGEX = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;

// Periodic cleanup of stale spam tracking records (every 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, tracking] of state.spamTracking.entries()) {
    if (!tracking.messages || tracking.messages.length === 0 || (now - tracking.messages[tracking.messages.length - 1] > 60000)) {
      state.spamTracking.delete(key);
    }
  }
}, 2 * 60 * 1000).unref();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    // --- 1. AFK CHECKS (Run for all messages in guild before any AI routing) ---
    if (message.guild) {
      // Check if author is returning from AFK
      if (state.afkUsers.has(message.author.id)) {
        const afkData = state.afkUsers.get(message.author.id);
        const duration = Date.now() - afkData.time;
        state.afkUsers.delete(message.author.id);

        message.reply(`Welcome back! You were AFK for ${formatDuration(duration)}.`).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 5000);
        }).catch(() => {});
      }

      // Check if message mentions any AFK users
      if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
          if (state.afkUsers.has(user.id)) {
            const afkData = state.afkUsers.get(user.id);
            message.reply(`${user.username} is currently AFK: ${afkData.reason}`).then(msg => {
              setTimeout(() => msg.delete().catch(() => {}), 10000);
            }).catch(() => {});
          }
        });
      }
    }

    // --- 2. AI ROUTING (DMs, bot mentions, or designated AI channels) ---
    const isDm = !message.guild;
    const isMentioned = message.guild && message.mentions.has(message.client.user.id) && !message.mentions.everyone;

    let isAiChannel = false;
    if (message.guild) {
      const settings = await getGuildSettings(message.guild.id);
      if (settings && settings.ask_channel_id) {
        isAiChannel = message.channel.id === settings.ask_channel_id;
      }
    }

    if (isDm || isMentioned || isAiChannel) {
      if (state.activeAskUsers.has(message.author.id)) {
        await message.reply('Please wait for the previous response to finish.').catch(() => {});
        return;
      }

      state.activeAskUsers.add(message.author.id);
      let replyMsg = null;

      try {
        let prompt = message.content;
        if (message.guild) {
          const botMentionEscaped = `<@!?${message.client.user.id}>`;
          prompt = prompt.replace(new RegExp(botMentionEscaped, 'g'), '').trim();
        }

        const imageAttachment = message.attachments.find(a =>
          (a.contentType && a.contentType.startsWith('image/')) ||
          /\.(png|jpe?g|gif|webp)$/i.test(a.name || '')
        );
        const imageUrl = imageAttachment ? imageAttachment.url : null;

        if (!prompt && !imageUrl) {
          await message.reply("How can I help you today?").catch(() => {});
          return;
        }

        if (!prompt && imageUrl) {
          prompt = 'Analyze this image for Master.';
        }

        await message.channel.sendTyping().catch(() => {});
        const pInfo = await getEffectivePersonality(message.author.id, message.guild?.id);
        replyMsg = await message.reply({ embeds: [createThinkingEmbed(pInfo)] }).catch(() => null);

        const executeAi = async () => {
          return await processAiChat({
            prompt,
            imageUrl,
            user: message.author,
            member: message.member,
            guild: message.guild,
            channel: message.channel,
            client: message.client,
          });
        };

        const aiResult = await executeAi();

        if (replyMsg) {
          await sendModernAiResponse({
            target: replyMsg,
            user: message.author,
            prompt,
            aiResult,
          });
        } else {
          const fallbackMsg = await message.reply({ content: '...' }).catch(() => null);
          if (fallbackMsg) {
            await sendModernAiResponse({
              target: fallbackMsg,
              user: message.author,
              prompt,
              aiResult,
            });
          }
        }
      } catch (error) {
        console.error('Auto-AI error:', error);
        if (replyMsg) {
          await replyMsg.edit({ content: 'An error occurred while processing the AI response.', embeds: [] }).catch(() => {});
        } else {
          await message.reply('An error occurred while processing the AI response.').catch(() => {});
        }
      } finally {
        state.activeAskUsers.delete(message.author.id);
      }
      return;
    }

    if (!message.guild) return;

    // --- 3. AUTO-MODERATION & AUTO-MUTE SYSTEM ---
    try {
      const member = message.member;
      if (!member) return;

      // Staff with ModerateMembers permissions bypass auto-moderation
      if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;

      // Anti-Invite link detection
      if (DISCORD_INVITE_REGEX.test(message.content)) {
        await message.delete().catch(() => {});

        const warnMsg = await message.channel.send({
          content: `⚠️ ${message.author}, posting unauthorized Discord server invite links is strictly forbidden!`
        }).catch(() => null);
        if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🛡️ Anti-Invite: Discord Invite Link Blocked')
          .addFields(
            { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Content', value: message.content.substring(0, 1000), inline: false }
          )
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_timeout10m:${message.author.id}`)
            .setLabel('Timeout 10m')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`mod_kick:${message.author.id}`)
            .setLabel('Kick')
            .setStyle(ButtonStyle.Secondary)
        );

        await sendLog(message.guild, embed, [actionRow]);
        await logModAction(message.guild.id, 'anti-invite (blocked)', message.client.user.id, message.author.id, 'Unauthorized Discord invite link');
        return;
      }

      const settings = await getAutoMuteSettings(message.guild.id);
      if (!settings) return;

      // Spam detection with sliding-window timestamps
      if (settings.spam_threshold && settings.spam_duration) {
        const trackingKey = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();
        const timeWindow = 5000; // 5 seconds

        let tracking = state.spamTracking.get(trackingKey);
        if (!tracking) {
          tracking = { count: 1, messages: [now] };
        } else {
          tracking.messages = tracking.messages.filter(t => now - t < timeWindow);
          tracking.messages.push(now);
          tracking.count = tracking.messages.length;
        }
        state.spamTracking.set(trackingKey, tracking);

        if (tracking.count >= settings.spam_threshold) {
          const duration = parseDuration(settings.spam_duration);

          try {
            await member.timeout(duration, 'Auto-mute: Spam detected');

            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('User Auto-Muted (Spam)')
              .addFields(
                { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Duration', value: settings.spam_duration, inline: true },
                { name: 'Reason', value: `Sent ${tracking.count} messages in 5 seconds`, inline: false }
              )
              .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`mod_untimeout:${message.author.id}`)
                .setLabel('Unmute / Remove Timeout')
                .setStyle(ButtonStyle.Success)
            );

            await sendLog(message.guild, embed, [actionRow]);
            await logModAction(message.guild.id, 'auto-mute (spam)', message.client.user.id, message.author.id, 'Spam detected');

            state.spamTracking.delete(trackingKey);

            const messagesToDelete = await message.channel.messages.fetch({ limit: tracking.count });
            const userMessages = messagesToDelete.filter(m => m.author.id === message.author.id);
            await message.channel.bulkDelete(userMessages, true).catch(() => {});
          } catch (error) {
            console.error('Error muting user for spam:', error);
          }
        }
      }

      // Bad words detection
      if (settings.badword_enabled && settings.badword_duration) {
        const badWords = await getBadWords(message.guild.id);

        if (badWords.length > 0 && containsBadWords(message.content, badWords)) {
          const duration = parseDuration(settings.badword_duration);

          try {
            await member.timeout(duration, 'Auto-mute: Bad language detected');

            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('User Auto-Muted (Bad Language)')
              .addFields(
                { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Duration', value: settings.badword_duration, inline: true },
                { name: 'Reason', value: 'Used inappropriate language', inline: false }
              )
              .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`mod_untimeout:${message.author.id}`)
                .setLabel('Unmute / Remove Timeout')
                .setStyle(ButtonStyle.Success)
            );

            await sendLog(message.guild, embed, [actionRow]);
            await logModAction(message.guild.id, 'auto-mute (bad word)', message.client.user.id, message.author.id, 'Bad language detected');

            await message.delete().catch(() => {});

            const warningMsg = await message.channel.send({
              content: `${message.author}, you have been muted for using inappropriate language.`
            });

            setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
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
