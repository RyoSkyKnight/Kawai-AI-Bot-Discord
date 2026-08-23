const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../services/guildSettings');
const { randomColor } = require('../utils/constants');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const settings = await getGuildSettings(member.guild.id);

      if (settings.auto_role) {
        const role = member.guild.roles.cache.get(settings.auto_role);
        if (role) {
          await member.roles.add(role);
        }
      }

      if (settings.welcome_channel && settings.welcome_message) {
        const channel = member.guild.channels.cache.get(settings.welcome_channel);
        if (channel) {
          const message = settings.welcome_message
            .replace('{user}', `<@${member.id}>`)
            .replace('{username}', member.user.username)
            .replace('{server}', member.guild.name);

          const embed = new EmbedBuilder()
            .setColor(randomColor)
            .setTitle('👋 Welcome!')
            .setDescription(message)
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error in guildMemberAdd:', error);
    }
  }
};
