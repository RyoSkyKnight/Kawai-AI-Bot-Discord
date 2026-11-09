const { parseDuration, formatDuration } = require('../../utils/duration');
const { addReminder } = require('../../services/reminderManager');

module.exports = {
  data: {
    name: 'remind',
    description: 'Set a persistent reminder countdown',
    options: [
      { name: 'time', type: 3, description: 'Time (e.g., 10s, 5m, 1h, 2d)', required: true },
      { name: 'message', type: 3, description: 'Reminder message or note', required: true }
    ]
  },
  async execute(interaction) {
    const time = interaction.options.getString('time');
    const message = interaction.options.getString('message');

    const duration = parseDuration(time);
    if (!duration || duration <= 0) {
      await interaction.reply({ content: '❌ Invalid time format! Use: 10s, 5m, 2h, or 1d', ephemeral: true });
      return;
    }

    const timeStr = formatDuration(duration, 'en');
    addReminder({
      userId: interaction.user.id,
      channelId: interaction.channelId,
      targetTimestamp: Date.now() + duration,
      timeStr,
      message,
    }, interaction.client);

    await interaction.reply({ content: `⏰ Ding-dong! I'll remind you in **${timeStr}**: "${message}" *(saved permanently)* 💕` });
  }
};
