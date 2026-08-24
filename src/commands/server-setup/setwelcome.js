const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../services/guildSettings');

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
      await interaction.reply({ content: "❌ You don't have permission to manage server!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ Missing ManageGuild permission!', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Welcome {user} to {server}!';

    try {
      const success = await updateGuildSettings(interaction.guild.id, {
        welcome_channel: channel.id,
        welcome_message: message
      });

      if (!success) {
        await interaction.editReply({ content: '❌ Failed to save welcome settings to database!' });
        return;
      }

      const settings = await getGuildSettings(interaction.guild.id);
      console.log('Saved settings verification:', settings);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Welcome System Configured')
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Message', value: message, inline: false }
        )
        .setFooter({ text: 'Use /testwelcome to preview' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Set welcome error:', error);
      await interaction.editReply({ content: '❌ An error occurred while configuring welcome system!' });
    }
  }
};
