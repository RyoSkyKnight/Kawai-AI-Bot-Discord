const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'shorten',
    description: 'Shorten a URL using is.gd',
    options: [
      {
        name: 'url',
        type: 3,
        description: 'URL to shorten (e.g. https://example.com)',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    const rawUrl = interaction.options.getString('url');
    let validUrl = rawUrl;
    if (!/^https?:\/\//i.test(validUrl)) {
      validUrl = 'https://' + validUrl;
    }

    try {
      new URL(validUrl);
    } catch (_) {
      await interaction.editReply({ content: '❌ Invalid URL format! Please provide a valid web link.' });
      return;
    }

    try {
      const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(validUrl)}`);
      const shortUrl = (await response.text()).trim();

      if (!response.ok || shortUrl.startsWith('Error:')) {
        await interaction.editReply({ content: `❌ Failed to shorten URL: ${shortUrl || 'Service error'}` });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🔗 URL Shortened')
        .addFields(
          { name: 'Original', value: validUrl },
          { name: 'Shortened', value: shortUrl }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to shorten URL! Please check the link and try again.' });
    }
  }
};
