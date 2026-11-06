const { PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'removelog',
    description: 'Disable server logging',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You do not have permission to manage this server.", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Bot is missing Manage Server permission.', ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      log_channel: null
    });

    await interaction.reply({ content: 'Logging has been disabled.', ephemeral: true });
  }
};
