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
      await interaction.reply({ content: "❌ You don't have permission to manage server!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ Missing ManageGuild permission!', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');

    await updateGuildSettings(interaction.guild.id, {
      log_channel: channel.id
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Logging Channel Set')
      .setDescription(`Moderation logs will be sent to <#${channel.id}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
