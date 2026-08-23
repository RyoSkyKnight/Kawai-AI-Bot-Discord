const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../../services/moderation');
const { sendLog } = require('../../services/logChannel');

module.exports = {
  data: {
    name: 'unban',
    description: 'Unban a user from the server',
    default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    options: [
      { name: 'user_id', type: 3, description: 'The user ID to unban', required: true },
      { name: 'reason', type: 3, description: 'Reason for the unban', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to unban members!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: '❌ Missing BanMembers permission!', ephemeral: true });
      return;
    }

    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, reason);
      await logModAction(interaction.guild.id, 'unban', interaction.user.id, userId, reason);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ User Unbanned')
        .addFields(
          { name: 'User ID', value: userId, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to unban user! Make sure the ID is correct.', ephemeral: true });
    }
  }
};
