const { EmbedBuilder } = require('discord.js');
const state = require('../../state');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'uptime',
    description: 'Check how long the bot has been running'
  },
  async execute(interaction) {
    const uptime = Date.now() - state.startTime;
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('⏱️ Bot Uptime')
      .setDescription(`The bot has been running for **${formatDuration(uptime)}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
