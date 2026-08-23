const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'define',
    description: 'Get dictionary definition of a word',
    options: [
      {
        name: 'word',
        type: 3,
        description: 'Word to define',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const word = interaction.options.getString('word');
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      const data = await response.json();

      if (!Array.isArray(data)) {
        await interaction.editReply({ content: '❌ Word not found!' });
        return;
      }

      const definition = data[0];
      const meaning = definition.meanings[0];

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📖 ${definition.word}`)
        .addFields(
          { name: 'Part of Speech', value: meaning.partOfSpeech, inline: true },
          { name: 'Definition', value: meaning.definitions[0].definition, inline: false }
        );

      if (meaning.definitions[0].example) {
        embed.addFields({ name: 'Example', value: meaning.definitions[0].example, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch definition!' });
    }
  }
};
