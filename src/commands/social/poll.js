const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'poll',
    description: 'Create a poll with up to 10 options',
    options: [
      { name: 'question', type: 3, description: 'The poll question', required: true },
      { name: 'option1', type: 3, description: 'First option', required: true },
      { name: 'option2', type: 3, description: 'Second option', required: true },
      { name: 'option3', type: 3, description: 'Third option', required: false },
      { name: 'option4', type: 3, description: 'Fourth option', required: false },
      { name: 'option5', type: 3, description: 'Fifth option', required: false }
    ]
  },
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [];

    for (let i = 1; i <= 5; i++) {
      const option = interaction.options.getString(`option${i}`);
      if (option) options.push(option);
    }

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('📊 Poll')
      .setDescription(`**${question}**\n\n${options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n')}`)
      .setFooter({ text: `Poll by ${interaction.user.username}` })
      .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await message.react(emojis[i]);
    }
  }
};
