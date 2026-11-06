const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getBadWords } = require('../../services/badWords');

module.exports = {
  data: {
    name: 'listbadwords',
    description: 'List all bad words',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString()
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "You do not have permission to view bad words.", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: 'Bot is missing Moderate Members permission.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const badWords = await getBadWords(interaction.guild.id);

    if (badWords.length === 0) {
      await interaction.editReply({ content: 'No bad words in the filter. Use `/addbadword` to add some.' });
      return;
    }

    const wordList = badWords.map((bw, i) => `${i + 1}. **${bw.word}**`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('Bad Words List')
      .setDescription(wordList.substring(0, 4096))
      .setFooter({ text: `Total: ${badWords.length} words` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
