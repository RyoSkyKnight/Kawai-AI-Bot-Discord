const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'setgoodbye',
    description: 'Set goodbye message configuration',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      { name: 'channel', type: 7, description: 'Channel to send goodbye messages', required: true },
      { name: 'message', type: 3, description: 'Goodbye message ({username} = name, {server} = server name)', required: false }
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
    const message = interaction.options.getString('message') || 'Goodbye {username}! Thanks for being part of {server}!';

    await updateGuildSettings(interaction.guild.id, {
      goodbye_channel: channel.id,
      goodbye_message: message
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Goodbye System Configured')
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Message', value: message, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
