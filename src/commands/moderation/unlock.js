const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'unlock',
    description: 'Unlock a channel',
    default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [
      { name: 'reason', type: 3, description: 'Reason for unlocking', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: "❌ You don't have permission to manage channels!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: '❌ Missing ManageChannels permission!', ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: null
      });
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🔓 Channel Unlocked')
        .setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
        .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to unlock channel!', ephemeral: true });
    }
  }
};
