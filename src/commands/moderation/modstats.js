const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getModStats } = require('../../services/moderation');

module.exports = {
  data: {
    name: 'modstats',
    description: 'View moderation statistics',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to view mod stats!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ Missing ModerateMembers permission!', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const logs = await getModStats(interaction.guild.id);

    const stats = {};
    logs.forEach(log => {
      if (!stats[log.action]) stats[log.action] = 0;
      stats[log.action]++;
    });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 Moderation Statistics')
      .setDescription(
        Object.entries(stats).length > 0
          ? Object.entries(stats).map(([action, count]) => `**${action}:** ${count}`).join('\n')
          : 'No moderation actions recorded.'
      )
      .setFooter({ text: `Total actions: ${logs.length}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
