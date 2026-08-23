const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'choose',
    description: 'Let the bot choose between multiple options',
    options: [
      {
        name: 'options',
        type: 3,
        description: 'Options separated by commas (e.g., pizza, burger, pasta)',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const options = interaction.options.getString('options').split(',').map(o => o.trim());

    if (options.length < 2) {
      await interaction.reply({ content: '❌ Please provide at least 2 options separated by commas!', ephemeral: true });
      return;
    }

    const chosen = options[Math.floor(Math.random() * options.length)];

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🤔 I Choose...')
      .setDescription(`Out of: ${options.join(', ')}\n\nI choose: **${chosen}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
