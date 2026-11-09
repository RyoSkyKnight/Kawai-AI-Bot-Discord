const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { addWarning, getWarnings, logModAction } = require('../../services/moderation');
const { sendLog } = require('../../services/logChannel');

module.exports = {
  data: {
    name: 'warn',
    description: 'Warn a user',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'user', type: 6, description: 'The user to warn', required: true },
      { name: 'reason', type: 3, description: 'Reason for the warning', required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "You do not have permission to warn members.", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: 'Bot is missing Moderate Members permission.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    await addWarning(interaction.guild.id, user.id, reason, interaction.user.id);
    const warnings = await getWarnings(interaction.guild.id, user.id);
    await logModAction(interaction.guild.id, 'warn', interaction.user.id, user.id, reason);

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('User Warned')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Total Warnings', value: warnings.length.toString(), inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mod_clearwarn:${user.id}`)
        .setLabel('Clear Warnings')
        .setStyle(ButtonStyle.Secondary)
    );

    await sendLog(interaction.guild, embed, [actionRow]);
    await interaction.reply({ embeds: [embed] });

    try {
      await user.send({ embeds: [embed] });
    } catch (error) {
      // User has DMs disabled
    }
  }
};
