const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeaskchannel')
    .setDescription('Disable the dedicated AI auto-reply channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /**
   * Execute the command.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const memberPerms = interaction.memberPermissions || interaction.member?.permissions;
    if (!memberPerms || !(memberPerms.has(PermissionFlagsBits.Administrator) || memberPerms.has(PermissionFlagsBits.ManageGuild))) {
      await interaction.reply({ content: 'You do not have permission to remove the AI channel. Only admins or members with Manage Server permission can do this.', ephemeral: true });
      return;
    }

    const success = await updateGuildSettings(guildId, { ask_channel_id: null });

    if (success) {
      await interaction.reply({ content: 'Dedicated AI channel has been disabled. The bot will now only respond to mentions in server channels.', ephemeral: false });
    } else {
      await interaction.reply({ content: 'Failed to update settings. Please try again later.', ephemeral: true });
    }
  },
};
