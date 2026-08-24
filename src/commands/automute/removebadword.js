const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { removeBadWord } = require('../../services/badWords');

module.exports = {
  data: {
    name: 'removebadword',
    description: 'Remove a bad word from the list',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'word', type: 3, description: 'The bad word to remove', required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to manage bad words!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ Missing ModerateMembers permission!', ephemeral: true });
      return;
    }

    const word = interaction.options.getString('word');

    await interaction.deferReply();

    const success = await removeBadWord(interaction.guild.id, word);

    if (!success) {
      await interaction.editReply({ content: '❌ Word not found in the filter!' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Bad Word Removed')
      .setDescription(`The word "**${word}**" has been removed from the filter.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
