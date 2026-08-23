const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'trivia',
    description: 'Get a random trivia question'
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
      const data = await response.json();
      const question = data.results[0];

      const answers = [...question.incorrect_answers, question.correct_answer].sort(() => Math.random() - 0.5);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🧠 Trivia Question')
        .setDescription(`**Category:** ${question.category}\n**Difficulty:** ${question.difficulty}\n\n${question.question}\n\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`)
        .setFooter({ text: `Answer: ${question.correct_answer}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch trivia. Please try again!' });
    }
  }
};
