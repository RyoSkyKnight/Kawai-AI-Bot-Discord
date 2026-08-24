const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'announce',
    description: 'Send an announcement to a channel',
    default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [
      { name: 'channel', type: 7, description: 'Channel to send announcement', required: true },
      { name: 'message', type: 3, description: 'Announcement message', required: true },
      { name: 'ping_everyone', type: 5, description: 'Ping @everyone', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "❌ You don't have permission to send announcements!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: '❌ Missing ManageMessages permission!', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const pingEveryone = interaction.options.getBoolean('ping_everyone') || false;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📢 Announcement')
      .setDescription(message)
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();

    try {
      await channel.send({
        content: pingEveryone ? '@everyone' : null,
        embeds: [embed]
      });

      await interaction.reply({ content: `✅ Announcement sent to <#${channel.id}>!`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to send announcement!', ephemeral: true });
    }
  }
};
