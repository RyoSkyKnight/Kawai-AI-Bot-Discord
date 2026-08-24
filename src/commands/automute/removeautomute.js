const { PermissionFlagsBits } = require('discord.js');
const { updateAutoMuteSettings } = require('../../services/autoMute');

module.exports = {
  data: {
    name: 'removeautomute',
    description: 'Remove automatic muting for spammers',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString()
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

    await interaction.deferReply();

    const success = await updateAutoMuteSettings(interaction.guild.id, {
      spam_threshold: null,
      spam_duration: null
    });

    if (!success) {
      await interaction.editReply({ content: '❌ Failed to remove auto-mute settings!' });
      return;
    }

    await interaction.editReply({ content: '✅ Auto-mute for spam has been disabled!' });
  }
};
