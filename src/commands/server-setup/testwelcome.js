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
      await interaction.reply({ content: "You do not have permission to manage this server.", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const settings = await getGuildSettings(interaction.guild.id).catch(() => ({}));

      let welcomeMsg = settings?.welcome_message;
      if (!welcomeMsg) {
        welcomeMsg = 'Welcome to **{server}**, {user}! Please check <#rules> and verify in <#verification> to get started.';
      }

      const formatted = welcomeMsg
        .replace('{user}', `<@${interaction.user.id}>`)
        .replace('{username}', interaction.user.username)
        .replace('{server}', interaction.guild.name);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('Welcome (Preview)')
        .setDescription(formatted)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: 'Preview of the welcome message' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Test welcome error:', error);
      await interaction.editReply({ content: 'An error occurred while testing the welcome message.' });
    }
  }
};
