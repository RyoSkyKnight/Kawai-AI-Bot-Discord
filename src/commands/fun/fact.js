const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'fact',
    description: 'Get a random interesting fact'
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
      const data = await response.json();

      const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('📚 Random Fact')
        .setDescription(data.text)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch fact. Please try again!' });
    }
  }
};
