const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarnings } = require('../../services/moderation');

module.exports = {
  data: {
    name: 'warnings',
    description: 'View warnings for a user',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to check warnings for', required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to view warnings!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ Missing ModerateMembers permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const warnings = await getWarnings(interaction.guild.id, user.id);

    if (warnings.length === 0) {
      await interaction.reply({ content: `${user.tag} has no warnings!`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle(`⚠️ Warnings for ${user.tag}`)
      .setDescription(warnings.map((w, i) =>
        `**${i + 1}.** ${w.reason}\n*By <@${w.moderator_id}> • <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>*`
      ).join('\n\n'))
      .setFooter({ text: `Total warnings: ${warnings.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
