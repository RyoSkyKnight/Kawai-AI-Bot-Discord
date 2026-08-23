const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'shorten',
    description: 'Shorten a URL',
    options: [
      {
        name: 'url',
        type: 3,
        description: 'URL to shorten',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const url = interaction.options.getString('url');
      const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
      const shortUrl = await response.text();

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🔗 URL Shortened')
        .addFields(
          { name: 'Original', value: url },
          { name: 'Shortened', value: shortUrl }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to shorten URL!' });
    }
  }
};
