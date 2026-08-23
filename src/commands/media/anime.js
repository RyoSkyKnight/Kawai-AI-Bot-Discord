const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'anime',
    description: 'Search for anime information',
    options: [
      {
        name: 'title',
        type: 3,
        description: 'Anime title',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const title = interaction.options.getString('title');
      const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        await interaction.editReply({ content: '❌ Anime not found!' });
        return;
      }

      const anime = data.data[0];
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(anime.title)
        .setThumbnail(anime.images.jpg.image_url)
        .addFields(
          { name: 'Episodes', value: anime.episodes?.toString() || 'N/A', inline: true },
          { name: 'Score', value: anime.score?.toString() || 'N/A', inline: true },
          { name: 'Status', value: anime.status, inline: true },
          { name: 'Type', value: anime.type, inline: true },
          { name: 'Year', value: anime.year?.toString() || 'N/A', inline: true },
          { name: 'Rating', value: anime.rating || 'N/A', inline: true },
          { name: 'Synopsis', value: anime.synopsis?.substring(0, 1024) || 'No synopsis', inline: false }
        )
        .setURL(anime.url)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch anime data!' });
    }
  }
};
