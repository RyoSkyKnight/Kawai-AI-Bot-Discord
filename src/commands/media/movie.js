const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'movie',
    description: 'Get information about a movie',
    options: [
      {
        name: 'title',
        type: 3,
        description: 'Movie title',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const title = interaction.options.getString('title');
      const response = await fetch(`https://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(title)}`);
      const data = await response.json();

      if (data.Response === 'False') {
        await interaction.editReply({ content: '❌ Movie not found!' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(data.Title)
        .setThumbnail(data.Poster !== 'N/A' ? data.Poster : null)
        .addFields(
          { name: 'Year', value: data.Year, inline: true },
          { name: 'Rating', value: data.imdbRating, inline: true },
          { name: 'Runtime', value: data.Runtime, inline: true },
          { name: 'Genre', value: data.Genre, inline: true },
          { name: 'Director', value: data.Director, inline: true },
          { name: 'Actors', value: data.Actors, inline: true },
          { name: 'Plot', value: data.Plot, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch movie data!' });
    }
  }
};
