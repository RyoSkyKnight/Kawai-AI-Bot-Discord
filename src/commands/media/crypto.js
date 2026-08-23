const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'crypto',
    description: 'Get cryptocurrency price',
    options: [
      {
        name: 'coin',
        type: 3,
        description: 'Cryptocurrency symbol (e.g., BTC, ETH)',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const coin = interaction.options.getString('coin').toUpperCase();
      const response = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`);
      const data = await response.json();

      if (data.errors) {
        await interaction.editReply({ content: '❌ Cryptocurrency not found!' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#F7931A')
        .setTitle(`💰 ${coin} Price`)
        .setDescription(`**$${parseFloat(data.data.amount).toLocaleString()}** USD`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch crypto price!' });
    }
  }
};
