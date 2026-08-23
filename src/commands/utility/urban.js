const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'urban',
    description: 'Look up a word in Urban Dictionary',
    options: [
      {
        name: 'word',
        type: 3,
        description: 'Word to look up',
        required: true
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const word = interaction.options.getString('word');
      const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
      const data = await response.json();

      if (!data.list || data.list.length === 0) {
        await interaction.editReply({ content: '❌ No definition found for that word!' });
        return;
      }

      const definition = data.list[0];
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`📖 ${definition.word}`)
        .setDescription(definition.definition.substring(0, 2000))
        .addFields(
          { name: 'Example', value: definition.example.substring(0, 1024) || 'No example' }
        )
        .setFooter({ text: `👍 ${definition.thumbs_up} | 👎 ${definition.thumbs_down}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch definition!' });
    }
  }
};
