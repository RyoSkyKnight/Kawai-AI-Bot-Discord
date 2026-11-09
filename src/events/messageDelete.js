const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../services/logChannel');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    // Ignore partial messages without author or bot messages
    if (!message || !message.guild || !message.author || message.author.bot) return;

    // Only detect if message contained mentions
    const hasUserMentions = message.mentions.users && message.mentions.users.filter(u => u.id !== message.author.id).size > 0;
    const hasRoleMentions = message.mentions.roles && message.mentions.roles.size > 0;
    const hasEveryone = message.mentions.everyone;

    if (!hasUserMentions && !hasRoleMentions && !hasEveryone) return;

    // Only detect ghost pings deleted within 2 minutes of sending
    const messageAge = Date.now() - (message.createdTimestamp || Date.now());
    if (messageAge > 120000) return;

    try {
      const mentionedTargets = [];
      if (hasEveryone) mentionedTargets.push('@everyone / @here');
      if (hasUserMentions) {
        message.mentions.users
          .filter(u => u.id !== message.author.id)
          .forEach(u => mentionedTargets.push(`<@${u.id}> (${u.tag})`));
      }
      if (hasRoleMentions) {
        message.mentions.roles.forEach(r => mentionedTargets.push(`<@&${r.id}> (${r.name})`));
      }

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('👻 Ghost Ping Detected')
        .addFields(
          { name: 'Author', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Mentioned', value: mentionedTargets.join(', ').substring(0, 1024), inline: false },
          { name: 'Deleted Message Content', value: message.content ? message.content.substring(0, 1024) : '*(No text content)*', inline: false }
        )
        .setFooter({ text: 'Cutie Bot • Anti-Ghost Ping' })
        .setTimestamp();

      await sendLog(message.guild, embed);

      // Send a temporary notice to the channel (deletes after 7 seconds)
      const notice = await message.channel.send({
        content: `👻 **Ghost Ping Detected!** <@${message.author.id}> pinged ${hasEveryone ? '@everyone' : message.mentions.users.filter(u => u.id !== message.author.id).map(u => `<@${u.id}>`).join(' ')} and deleted the message!`
      }).catch(() => null);

      if (notice) {
        setTimeout(() => notice.delete().catch(() => {}), 7000);
      }
    } catch (err) {
      console.error('Error in messageDelete ghost ping detection:', err);
    }
  },
};

