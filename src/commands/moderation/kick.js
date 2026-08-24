const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../../services/moderation');
const { sendLog } = require('../../services/logChannel');

module.exports = {
  data: {
    name: 'kick',
    description: 'Kick a user from the server',
    default_member_permissions: PermissionFlagsBits.KickMembers.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to kick', required: true },
      { name: 'reason', type: 3, description: 'Reason for the kick', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to kick members!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({ content: '❌ Missing KickMembers permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (member.roles.highest.position >= botMember.roles.highest.position) {
        await interaction.reply({ content: '❌ I cannot kick this user due to role hierarchy!', ephemeral: true });
        return;
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        await interaction.reply({ content: '❌ You cannot kick this user!', ephemeral: true });
        return;
      }

      await member.kick(reason);
      await logModAction(interaction.guild.id, 'kick', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('👢 User Kicked')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to kick user!', ephemeral: true });
    }
  }
};
