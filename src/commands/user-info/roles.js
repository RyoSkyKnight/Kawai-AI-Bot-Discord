const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'roles',
    description: 'List all roles in the server or roles of a user',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to check roles for',
        required: false
      }
    ]
  },
  async execute(interaction) {
    const user = interaction.options.getUser('user');

    if (user) {
      const member = await interaction.guild.members.fetch(user.id);
      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎭 Roles for ${user.username}`)
        .setDescription(roles.length ? roles.join(', ') : 'No roles')
        .setFooter({ text: `Total: ${roles.length} roles` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else {
      const roles = interaction.guild.roles.cache
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎭 All Roles in ${interaction.guild.name}`)
        .setDescription(roles.join(', '))
        .setFooter({ text: `Total: ${roles.length} roles` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
};
