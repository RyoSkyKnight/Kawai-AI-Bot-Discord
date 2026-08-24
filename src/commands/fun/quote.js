const { EmbedBuilder } = require('discord.js');
const { quotes } = require('../../utils/constants');

module.exports = {
  data: {
    name: 'quote',
    description: 'Get a random inspirational quote'
  },
  async execute(interaction) {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('💬 Inspirational Quote')
      .setDescription(`*"${quote.text}"*`)
      .setFooter({ text: `— ${quote.author}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
