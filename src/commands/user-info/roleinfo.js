const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'roleinfo',
    description: 'Get information about a role',
    options: [
      {
        name: 'role',
        type: 8,
        description: 'The role to get info about',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const role = interaction.options.getRole('role');

    const embed = new EmbedBuilder()
      .setColor(role.hexColor)
      .setTitle(`Role Information: ${role.name}`)
      .addFields(
        { name: '🆔 ID', value: role.id, inline: true },
        { name: '🎨 Color', value: role.hexColor, inline: true },
        { name: '👥 Members', value: role.members.size.toString(), inline: true },
        { name: '📍 Position', value: role.position.toString(), inline: true },
        { name: '📌 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: '🔔 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
