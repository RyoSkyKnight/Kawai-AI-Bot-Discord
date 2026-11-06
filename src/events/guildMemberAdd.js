const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../services/guildSettings');
const { randomColor } = require('../utils/constants');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const settings = await getGuildSettings(member.guild.id).catch(() => ({}));

      // 1. Auto-Role (with automatic fallback to "Member Jelata")
      let role = null;
      if (settings?.auto_role) {
        role = member.guild.roles.cache.get(settings.auto_role);
      }
      if (!role) {
        role = member.guild.roles.cache.find(
          r => r.name.toLowerCase() === 'member jelata' || r.name.toLowerCase() === 'unverified'
        );
      }
      if (role) {
        await member.roles.add(role).catch(err => console.error('Failed to assign auto-role:', err.message));
      }

      // 2. Welcome Message (with automatic fallback to #welcome channel)
      let channel = null;
      if (settings?.welcome_channel) {
        channel = member.guild.channels.cache.get(settings.welcome_channel);
      }
      if (!channel) {
        channel = member.guild.channels.cache.find(
          c => c.name.toLowerCase() === 'welcome' && c.isTextBased()
        );
      }

      if (channel) {
        let welcomeMsg = settings?.welcome_message;
        if (!welcomeMsg) {
          welcomeMsg = 'Welcome to **{server}**, {user}! Please check <#rules> and verify in <#verification> to get started.';
        }

        const formatted = welcomeMsg
          .replace('{user}', `<@${member.id}>`)
          .replace('{username}', member.user.username)
          .replace('{server}', member.guild.name);

        const embed = new EmbedBuilder()
          .setColor(randomColor || '#3498DB')
          .setTitle('Welcome')
          .setDescription(formatted)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(err => console.error('Failed to send welcome message:', err.message));
      }
    } catch (error) {
      console.error('Error in guildMemberAdd:', error);
    }
  }
};
