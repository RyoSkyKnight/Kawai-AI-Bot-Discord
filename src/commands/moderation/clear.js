const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'clear',
    description: 'Clear messages in a channel',
    default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [
      { name: 'amount', type: 4, description: 'Number of messages to delete (1-100)', required: true },
      { name: 'user', type: 6, description: 'Only delete messages from this user', required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "❌ You don't have permission to manage messages!", ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: '❌ Missing ManageMessages permission!', ephemeral: true });
      return;
    }

    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');
    if (amount < 1 || amount > 100) {
      await interaction.reply({ content: '❌ Please provide a number between 1 and 100!', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      const filteredMessages = targetUser
        ? messages.filter(msg => msg.author.id === targetUser.id)
        : messages;
      const deleted = await interaction.channel.bulkDelete(filteredMessages, true);
      await interaction.editReply({ content: `✅ Deleted ${deleted.size} messages!` });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to delete messages!' });
    }
  }
};
