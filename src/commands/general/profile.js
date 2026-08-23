const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'profile',
    description: "Check a user's Discord profile information",
    options: [
      {
        name: 'user',
        description: 'The user you want to check',
        type: 6,
        required: false
      }
    ]
  },
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`👤 Profile for ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: 'Username', value: user.username, inline: true },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Roles', value: member.roles.cache.size.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
