const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../services/guildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setaskchannel')
    .setDescription('Set the channel where the bot will respond to messages (auto‑reply).')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel to allow AI replies')
        .addChannelTypes(0) // GuildText
        .setRequired(true)
    )
    // Only admins (or members with ManageGuild) may use this command
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /**
   * Execute the command.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Permission guard – ensure the user has admin or ManageGuild rights
    const memberPerms = interaction.memberPermissions;
    if (!memberPerms || !(memberPerms.has(PermissionFlagsBits.Administrator) || memberPerms.has(PermissionFlagsBits.ManageGuild))) {
      await interaction.reply({ content: '❌ You do not have permission to set the AI channel. Only admins or members with Manage Server permission can do this.', ephemeral: true });
      return;
    }

    const success = await updateGuildSettings(guildId, { ask_channel_id: channel.id });

    if (success) {
      await interaction.reply({ content: `✅ AI auto‑reply channel set to <#${channel.id}>.`, ephemeral: false });
    } else {
      await interaction.reply({ content: '❌ Failed to update settings. Please try again later.', ephemeral: true });
    }
  },
};
