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
