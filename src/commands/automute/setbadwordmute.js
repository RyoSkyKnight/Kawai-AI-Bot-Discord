const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateAutoMuteSettings } = require('../../services/autoMute');
const { parseDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'setbadwordmute',
    description: 'Set up automatic muting for bad language',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
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

    const duration = interaction.options.getString('duration');

    const ms = parseDuration(duration);
    if (!ms || ms > 2419200000) {
      await interaction.reply({ content: '❌ Invalid duration! Maximum is 28 days (28d).', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const success = await updateAutoMuteSettings(interaction.guild.id, {
      badword_enabled: true,
      badword_duration: duration
    });

    if (!success) {
      await interaction.editReply({ content: '❌ Failed to save bad word mute settings!' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Auto-Mute for Bad Words Enabled')
      .addFields(
        { name: 'Mute Duration', value: duration, inline: true }
      )
      .setDescription('Users will be automatically muted when they use bad words.\nUse `/addbadword` to add words to the filter.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
