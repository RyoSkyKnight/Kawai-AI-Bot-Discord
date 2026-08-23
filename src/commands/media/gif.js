const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'gif',
    description: 'Search for a GIF',
    options: [
      {
        name: 'query',
        type: 3,
        description: 'Search query',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString('query');
      const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=1`);
      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        await interaction.editReply({ content: '❌ No GIF found!' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`🎬 ${query}`)
        .setImage(data.results[0].media_formats.gif.url)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch GIF!' });
    }
  }
};
