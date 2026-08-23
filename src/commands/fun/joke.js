const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'joke',
    description: 'Get a random joke'
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://official-joke-api.appspot.com/random_joke');
      const data = await response.json();

      const embed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('😄 Random Joke')
        .setDescription(`**${data.setup}**\n\n${data.punchline}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch joke. Please try again!' });
    }
  }
};
