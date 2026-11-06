const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../services/guildSettings');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const settings = await getGuildSettings(member.guild.id).catch(() => ({}));

      // Goodbye Message (with automatic fallback to #welcome channel)
      let channel = null;
      if (settings?.goodbye_channel) {
        channel = member.guild.channels.cache.get(settings.goodbye_channel);
      }
      if (!channel) {
        channel = member.guild.channels.cache.find(
          c => c.name.toLowerCase() === 'welcome' && c.isTextBased()
        );
      }

      if (channel) {
        let goodbyeMsg = settings?.goodbye_message;
        if (!goodbyeMsg) {
          goodbyeMsg = 'Goodbye **{username}**, take care!';
        }

        const formatted = goodbyeMsg
          .replace('{username}', member.user.username)
          .replace('{server}', member.guild.name);

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('Goodbye')
          .setDescription(formatted)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(err => console.error('Failed to send goodbye message:', err.message));
      }
    } catch (error) {
      console.error('Error in guildMemberRemove:', error);
    }
  }
};
