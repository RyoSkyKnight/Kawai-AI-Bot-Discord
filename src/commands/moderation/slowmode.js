const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'slowmode',
    description: 'Set slowmode for the channel',
    default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [
      { name: 'duration', type: 4, description: 'Slowmode duration in seconds (0 to disable)', required: true }
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

    const duration = interaction.options.getInteger('duration');

    if (duration < 0 || duration > 21600) {
      await interaction.reply({ content: '❌ Duration must be between 0 and 21600 seconds (6 hours)!', ephemeral: true });
      return;
    }
    try {
      await interaction.channel.setRateLimitPerUser(duration);
      const embed = new EmbedBuilder()
        .setColor(duration === 0 ? '#00FF00' : '#FFA500')
        .setTitle(duration === 0 ? '✅ Slowmode Disabled' : '⏰ Slowmode Enabled')
        .setDescription(duration === 0 ? 'Slowmode has been disabled.' : `Slowmode set to ${duration} seconds.`)
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to set slowmode!', ephemeral: true });
    }
  }
};
