const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'autorole',
    description: 'Set auto role for new members',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      { name: 'role', type: 8, description: 'Role to give to new members', required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: "You do not have permission to manage roles.", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'Bot is missing Manage Roles permission.', ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('role');

    if (role.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: "Cannot assign a role equal to or higher than the bot's highest role.",
        ephemeral: true,
      });
      return;
    }

    if (role.managed) {
      await interaction.reply({
        content: 'Cannot assign an integration or managed role.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    await updateGuildSettings(interaction.guild.id, {
      auto_role: role.id
    });

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('Auto Role Configured')
      .setDescription(`New members will automatically receive the ${role} role.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
