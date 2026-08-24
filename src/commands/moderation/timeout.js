const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../../services/moderation');
const { sendLog } = require('../../services/logChannel');
const { parseDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'timeout',
    description: 'Timeout a user (mute temporarily)',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to timeout', required: true },
      { name: 'duration', type: 3, description: 'Duration (e.g., 10m, 1h, 1d)', required: true },
      { name: 'reason', type: 3, description: 'Reason for the timeout', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to timeout members!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ Missing ModerateMembers permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const ms = parseDuration(duration);
    if (!ms || ms > 2419200000) {
      await interaction.reply({ content: '❌ Invalid duration! Maximum is 28 days (28d).', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (member.roles.highest.position >= botMember.roles.highest.position) {
        await interaction.reply({ content: '❌ I cannot timeout this user due to role hierarchy!', ephemeral: true });
        return;
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        await interaction.reply({ content: '❌ You cannot timeout this user!', ephemeral: true });
        return;
      }

      await member.timeout(ms, reason);
      await logModAction(interaction.guild.id, 'timeout', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏰ User Timed Out')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Duration', value: duration, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to timeout user!', ephemeral: true });
    }
  }
};
