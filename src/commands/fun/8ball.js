const { EmbedBuilder } = require('discord.js');
const { eightBallResponses } = require('../../utils/constants');

module.exports = {
  data: {
    name: '8ball',
    description: 'Ask the magic 8ball a yes/no question',
    options: [
      {
        name: 'question',
        type: 3,
        description: 'Your yes/no question',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const response = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🔮 Magic 8Ball')
      .addFields(
        { name: 'Question', value: question },
        { name: 'Answer', value: response }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
