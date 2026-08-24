const figlet = require('figlet');

module.exports = {
  data: {
    name: 'ascii',
    description: 'Convert text to ASCII art',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text to convert',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const text = interaction.options.getString('text');

    await interaction.deferReply();

    if (text.length > 15) {
      await interaction.editReply({ content: '❌ Text too long! Please use 15 characters or less.' });
      return;
    }

    figlet(text, (err, data) => {
      if (err) {
        interaction.editReply({ content: '❌ Failed to generate ASCII art!' });
        return;
      }

      interaction.editReply({ content: `\`\`\`${data}\`\`\`` });
    });
  }
};
