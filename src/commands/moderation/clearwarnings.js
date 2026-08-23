const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { clearWarnings } = require('../../services/moderation');

module.exports = {
  data: {
    name: 'clearwarnings',
    description: 'Clear all warnings for a user',
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to clear warnings for', required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ You need Administrator permission to clear warnings!', ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Missing Administrator permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');

    await clearWarnings(interaction.guild.id, user.id);
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Warnings Cleared')
      .setDescription(`All warnings for ${user.tag} have been cleared.`)
      .setFooter({ text: `Cleared by ${interaction.user.tag}` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
