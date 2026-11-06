const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'setwelcome',
    description: 'Set welcome message configuration',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      { name: 'channel', type: 7, description: 'Channel to send welcome messages', required: true },
      { name: 'message', type: 3, description: 'Welcome message ({user} = mention, {username} = name, {server} = server name)', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You do not have permission to manage this server.", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Missing ManageGuild permission.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Welcome to {server}, {user}!';

    try {
      await updateGuildSettings(interaction.guild.id, {
        welcome_channel: channel.id,
        welcome_message: message
      });

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('Welcome System Configured')
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Message', value: message, inline: false }
        )
        .setFooter({ text: 'Use /testwelcome to preview' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Set welcome error:', error);
      await interaction.editReply({ content: 'An error occurred while configuring the welcome system.' });
    }
  }
};
