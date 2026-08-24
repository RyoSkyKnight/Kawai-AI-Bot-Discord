const { parseDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'remind',
    description: 'Set a reminder',
    options: [
      { name: 'time', type: 3, description: 'Time (e.g., 10m, 1h, 2d)', required: true },
      { name: 'message', type: 3, description: 'Reminder message', required: true }
    ]
  },
  async execute(interaction) {
    const time = interaction.options.getString('time');
    const message = interaction.options.getString('message');

    const duration = parseDuration(time);
    if (!duration) {
      await interaction.reply({ content: '❌ Invalid time format! Use: 10s, 5m, 2h, or 1d', ephemeral: true });
      return;
    }

    await interaction.reply({ content: `⏰ I'll remind you in ${time}: ${message}` });

    setTimeout(() => {
      interaction.user.send(`⏰ **Reminder:** ${message}`)
        .catch(() => interaction.followUp({ content: `<@${interaction.user.id}> ⏰ **Reminder:** ${message}` }));
    }, duration);
  }
};
