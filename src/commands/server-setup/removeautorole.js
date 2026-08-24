const { PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'removeautorole',
    description: 'Remove auto role for new members',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
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

    await updateGuildSettings(interaction.guild.id, {
      auto_role: null
    });

    await interaction.reply({ content: '✅ Auto role has been disabled!', ephemeral: true });
  }
};
