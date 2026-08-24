const { PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'removewelcome',
    description: 'Disable welcome messages',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ You don't have permission to manage server!", ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      welcome_channel: null,
      welcome_message: null
    });

    await interaction.reply({ content: '✅ Welcome system has been disabled!', ephemeral: true });
  }
};
