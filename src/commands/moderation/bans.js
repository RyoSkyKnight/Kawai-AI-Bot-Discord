const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'bans',
    description: 'List all banned users',
    default_member_permissions: PermissionFlagsBits.BanMembers.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: "You do not have permission to view bans.", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: 'Bot is missing Ban Members permission.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const bans = await interaction.guild.bans.fetch();

      if (bans.size === 0) {
        await interaction.editReply({ content: 'No banned users found.' });
        return;
      }

      const banList = bans.map((ban, index) =>
        `${index + 1}. ${ban.user.tag} (${ban.user.id})\n   Reason: ${ban.reason || 'No reason provided'}`
      ).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`Banned Users (${bans.size})`)
        .setDescription(banList.substring(0, 4096))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: 'Failed to fetch ban list.' });
    }
  }
};
