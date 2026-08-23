const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'serverinfo',
    description: 'Display information about the current server'
  },
  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch();

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: '🔒 Verification Level', value: guild.verificationLevel.toString(), inline: true },
        { name: '📊 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
        { name: '💎 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
