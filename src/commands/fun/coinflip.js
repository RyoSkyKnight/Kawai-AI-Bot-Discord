const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'coinflip',
    description: 'Flip a coin and get heads or tails'
  },
  async execute(interaction) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const emoji = result === 'Heads' ? '👑' : '⚪';

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Coin Flip')
      .setDescription(`${emoji} The coin landed on **${result}**!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
