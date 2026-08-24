const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'embed',
    description: 'Create a custom embed message',
    options: [
      { name: 'title', type: 3, description: 'Embed title', required: true },
      { name: 'description', type: 3, description: 'Embed description', required: true },
      { name: 'color', type: 3, description: 'Hex color (e.g., #FF0000)', required: false }
    ]
  },
  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color') || '#5865F2';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: `Created by ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
