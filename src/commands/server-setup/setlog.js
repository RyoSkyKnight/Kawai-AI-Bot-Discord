const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'setlog',
    description: 'Set logging channel for server events',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      { name: 'channel', type: 7, description: 'Channel for logging', required: true }
    ]
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

    const channel = interaction.options.getChannel('channel');

    await interaction.deferReply();

    await updateGuildSettings(interaction.guild.id, {
      log_channel: channel.id
    });

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('Logging Channel Configured')
      .setDescription(`Moderation logs will be sent to <#${channel.id}>`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
