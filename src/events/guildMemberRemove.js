const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../services/guildSettings');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const settings = await getGuildSettings(member.guild.id);

      if (settings.goodbye_channel && settings.goodbye_message) {
        const channel = member.guild.channels.cache.get(settings.goodbye_channel);
        if (channel) {
          const message = settings.goodbye_message
            .replace('{username}', member.user.username)
            .replace('{server}', member.guild.name);

          const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('👋 Goodbye!')
            .setDescription(message)
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error in guildMemberRemove:', error);
    }
  }
};
