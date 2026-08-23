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
      await interaction.reply({ content: "❌ You don't have permission to manage server!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ Missing ManageGuild permission!', ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      log_channel: null
    });

    await interaction.reply({ content: '✅ Logging has been disabled!', ephemeral: true });
  }
};
