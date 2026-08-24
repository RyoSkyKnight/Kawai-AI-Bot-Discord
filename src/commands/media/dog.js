const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'dog',
    description: 'Get a random dog image'
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://dog.ceo/api/breeds/image/random');
      const data = await response.json();

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🐕 Random Dog')
        .setImage(data.message)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch dog image!' });
    }
  }
};
