const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'deleterole',
    description: 'Delete a role',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      { name: 'role', type: 8, description: 'The role to delete', required: true }
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

    const role = interaction.options.getRole('role');

    if (role.position >= interaction.member.roles.highest.position) {
      await interaction.reply({ content: '❌ You cannot delete this role!', ephemeral: true });
      return;
    }

    try {
      await role.delete(`Deleted by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('✅ Role Deleted')
        .setDescription(`Role **${role.name}** has been deleted.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to delete role!', ephemeral: true });
    }
  }
};
