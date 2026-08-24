const { EmbedBuilder } = require('discord.js');
const math = require('mathjs');

module.exports = {
  data: {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    options: [
      {
        name: 'expression',
        type: 3,
        description: 'Math expression (e.g., 2+2, 10*5, sqrt(16))',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const expression = interaction.options.getString('expression');

    try {
      const result = math.evaluate(expression);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🧮 Calculator')
        .addFields(
          { name: 'Expression', value: `\`${expression}\``, inline: false },
          { name: 'Result', value: `\`${result}\``, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error evaluating expression:', error);
      await interaction.reply({ content: '❌ Invalid expression. Please check your math!', ephemeral: true });
    }
  }
};
