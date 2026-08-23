const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: {
    name: 'testwelcome',
    description: 'Test the welcome message',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ You don't have permission to manage server!", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const settings = await getGuildSettings(interaction.guild.id);
      console.log('Welcome settings:', settings);

      if (!settings || !settings.welcome_channel || !settings.welcome_message) {
        await interaction.editReply({ content: '❌ Welcome system is not configured! Use /setwelcome first.' });
        return;
      }

      const message = settings.welcome_message
        .replace('{user}', `<@${interaction.user.id}>`)
        .replace('{username}', interaction.user.username)
        .replace('{server}', interaction.guild.name);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('👋 Welcome! (Test)')
        .setDescription(message)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: 'This is a test preview of the welcome message' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Test welcome error:', error);
      await interaction.editReply({ content: '❌ An error occurred while testing welcome message!' });
    }
  }
};
