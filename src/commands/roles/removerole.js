const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'removerole',
    description: 'Remove a role from a user',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to remove role from', required: true },
      { name: 'role', type: 8, description: 'The role to remove', required: true },
      { name: 'reason', type: 3, description: 'Reason for removing the role', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: "❌ You don't have permission to manage roles!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ Missing ManageRoles permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    await interaction.deferReply();

    try {
      let member;
      try {
        member = await interaction.guild.members.fetch({ user: user.id, force: true });
      } catch (fetchError) {
        await interaction.editReply({ content: '❌ User is not a member of this server!' });
        return;
      }

      if (role.position >= botMember.roles.highest.position) {
        await interaction.editReply({ content: '❌ I cannot manage this role! My highest role must be above this role.' });
        return;
      }

      if (role.position >= interaction.member.roles.highest.position) {
        await interaction.editReply({ content: '❌ You cannot manage this role! Your highest role must be above this role.' });
        return;
      }

      if (!member.roles.cache.has(role.id)) {
        await interaction.editReply({ content: `❌ ${user.tag} doesn't have the ${role.name} role!` });
        return;
      }

      await member.roles.remove(role, reason);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('✅ Role Removed')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Role', value: role.name, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Remove role error:', error);
      await interaction.editReply({ content: `❌ Failed to remove role! Error: ${error.message}` });
    }
  }
};
