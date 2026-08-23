const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'untimeout',
    description: 'Remove timeout from a user',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to remove timeout from', required: true },
      { name: 'reason', type: 3, description: 'Reason for removing timeout', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to remove timeouts!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ Missing ModerateMembers permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(null, reason);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Timeout Removed')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to remove timeout!', ephemeral: true });
    }
  }
};
