const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'reverse',
    description: 'Reverse text',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text to reverse',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const reversed = text.split('').reverse().join('');

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🔄 Reversed Text')
      .addFields(
        { name: 'Original', value: text },
        { name: 'Reversed', value: reversed }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
