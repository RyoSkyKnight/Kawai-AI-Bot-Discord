const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'nickname',
    description: "Change a user's nickname",
    default_member_permissions: PermissionFlagsBits.ManageNicknames.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to change nickname', required: true },
      { name: 'nickname', type: 3, description: 'New nickname (leave empty to reset)', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({ content: "❌ You don't have permission to manage nicknames!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({ content: '❌ Missing ManageNicknames permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.setNickname(nickname);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Nickname Changed')
        .setDescription(`${user.tag}'s nickname has been ${nickname ? `changed to **${nickname}**` : 'reset'}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to change nickname!', ephemeral: true });
    }
  }
};
