const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addBadWord } = require('../../services/badWords');

module.exports = {
  data: {
    name: 'addbadword',
    description: 'Add a bad word to the list',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'word', type: 3, description: 'The bad word to add', required: true }
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

    if (word.length < 2 || word.length > 50) {
      await interaction.reply({ content: '❌ Word must be between 2 and 50 characters!', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const result = await addBadWord(interaction.guild.id, word, interaction.user.id);

    if (!result.success) {
      await interaction.editReply({ content: `❌ Failed to add bad word: ${result.error}` });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Bad Word Added')
      .setDescription(`The word "**${word}**" has been added to the filter.`)
      .setFooter({ text: `Added by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
