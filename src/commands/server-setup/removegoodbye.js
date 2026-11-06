const { PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'removegoodbye',
    description: 'Disable goodbye messages',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You do not have permission to manage this server.", ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      goodbye_channel: null,
      goodbye_message: null
    });

    await interaction.reply({ content: 'Goodbye system has been disabled.', ephemeral: true });
  }
};
