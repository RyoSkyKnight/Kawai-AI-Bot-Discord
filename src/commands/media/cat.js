const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'cat',
    description: 'Get a random cat image'
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await response.json();

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🐱 Random Cat')
        .setImage(data[0].url)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch cat image!' });
    }
  }
};
