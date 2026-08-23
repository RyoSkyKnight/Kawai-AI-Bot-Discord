const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'wiki',
    description: 'Search Wikipedia',
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
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.type === 'disambiguation') {
        await interaction.editReply({ content: '❌ Multiple results found. Please be more specific!' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(data.title)
        .setDescription(data.extract)
        .setThumbnail(data.thumbnail ? data.thumbnail.source : null)
        .setURL(data.content_urls.desktop.page)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ No Wikipedia article found!' });
    }
  }
};
