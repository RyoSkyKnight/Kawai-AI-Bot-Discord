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
      await interaction.reply({ content: "❌ You don't have permission to manage roles!", ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('role');

    await updateGuildSettings(interaction.guild.id, {
      auto_role: role.id
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Auto Role Configured')
      .setDescription(`New members will automatically receive the ${role} role.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
