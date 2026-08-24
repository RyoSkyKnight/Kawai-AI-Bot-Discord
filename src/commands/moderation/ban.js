const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../../services/moderation');
const { sendLog } = require('../../services/logChannel');

module.exports = {
  data: {
    name: 'ban',
    description: 'Ban a user from the server',
    default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to ban', required: true },
      { name: 'reason', type: 3, description: 'Reason for the ban', required: false },
      { name: 'delete_messages', type: 4, description: 'Delete messages from the last X days (0-7)', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to ban members!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: '❌ Missing BanMembers permission!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_messages') || 0;

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          await interaction.reply({ content: '❌ I cannot ban this user due to role hierarchy!', ephemeral: true });
          return;
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          await interaction.reply({ content: '❌ You cannot ban this user!', ephemeral: true });
          return;
        }
      }

      await interaction.guild.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
      await logModAction(interaction.guild.id, 'ban', interaction.user.id, user.id, reason);

      const logEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 User Banned')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, logEmbed);
      await interaction.reply({ embeds: [logEmbed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to ban user!', ephemeral: true });
    }
  }
};
