const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateAutoMuteSettings } = require('../../services/autoMute');
const { parseDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'setautomute',
    description: 'Set up automatic muting for spammers',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      { name: 'threshold', type: 4, description: 'Number of messages in a short time to trigger mute', required: true },
      { name: 'duration', type: 3, description: 'Duration to mute the user (e.g. 10m, 1h)', required: true }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You don't have permission to manage auto-mute settings!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ Missing ModerateMembers permission!', ephemeral: true });
      return;
    }

    const threshold = interaction.options.getInteger('threshold');
    const duration = interaction.options.getString('duration');

    if (threshold < 3 || threshold > 20) {
      await interaction.reply({ content: '❌ Threshold must be between 3 and 20 messages!', ephemeral: true });
      return;
    }

    const ms = parseDuration(duration);
    if (!ms || ms > 2419200000) {
      await interaction.reply({ content: '❌ Invalid duration! Maximum is 28 days (28d).', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const success = await updateAutoMuteSettings(interaction.guild.id, {
      spam_threshold: threshold,
      spam_duration: duration
    });

    if (!success) {
      await interaction.editReply({ content: '❌ Failed to save auto-mute settings!' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Auto-Mute for Spam Enabled')
      .addFields(
        { name: 'Spam Threshold', value: `${threshold} messages in 5 seconds`, inline: true },
        { name: 'Mute Duration', value: duration, inline: true }
      )
      .setFooter({ text: 'Users will be automatically muted when they spam' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
