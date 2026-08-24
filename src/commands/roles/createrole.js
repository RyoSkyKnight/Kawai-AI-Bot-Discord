const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'createrole',
    description: 'Create a new role',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      { name: 'name', type: 3, description: 'Role name', required: true },
      { name: 'color', type: 3, description: 'Role color (hex, e.g., #FF0000)', required: false },
      { name: 'hoist', type: 5, description: 'Display role separately', required: false },
      { name: 'mentionable', type: 5, description: 'Allow anyone to mention this role', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: "❌ You don't have permission to manage roles!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ Missing ManageRoles permission!', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name');
    const color = interaction.options.getString('color') || '#99AAB5';
    const hoist = interaction.options.getBoolean('hoist') || false;
    const mentionable = interaction.options.getBoolean('mentionable') || false;

    try {
      const role = await interaction.guild.roles.create({
        name: name,
        color: color,
        hoist: hoist,
        mentionable: mentionable,
        reason: `Created by ${interaction.user.tag}`
      });

      const embed = new EmbedBuilder()
        .setColor(role.hexColor)
        .setTitle('✅ Role Created')
        .addFields(
          { name: 'Role Name', value: role.name, inline: true },
          { name: 'Color', value: role.hexColor, inline: true },
          { name: 'Hoisted', value: hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: mentionable ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to create role!', ephemeral: true });
    }
  }
};
