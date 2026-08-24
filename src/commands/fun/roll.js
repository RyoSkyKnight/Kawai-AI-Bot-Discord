const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'roll',
    description: 'Roll a dice',
    options: [
      {
        name: 'sides',
        type: 4,
        description: 'Number of sides on the dice (default: 6)',
        required: false
      }
    ]
  },
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    if (sides < 2 || sides > 100) {
      await interaction.reply({ content: '❌ Please choose between 2 and 100 sides!', ephemeral: true });
      return;
    }

    const result = Math.floor(Math.random() * sides) + 1;
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('🎲 Dice Roll')
      .setDescription(`You rolled a **${result}** on a ${sides}-sided dice!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
