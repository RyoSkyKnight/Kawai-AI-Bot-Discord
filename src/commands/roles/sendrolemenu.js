const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  data: {
    name: 'sendrolemenu',
    description: 'Send the interactive role selection menu to a channel',
    default_member_permissions: String(PermissionFlagsBits.ManageRoles),
    options: [
      {
        name: 'channel',
        type: 7, // CHANNEL
        description: 'Target channel to send the role menu (default: current channel)',
        required: false
      }
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: 'You need `Manage Roles` permission to use this command.',
        ephemeral: true
      });
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('Role Selection / Pilih Role')
      .setDescription(
        '**English:**\n' +
        'Click the buttons below to assign or remove your roles.\n' +
        '*Click once to get a role, click again to remove it.*\n\n' +
        '**Bahasa Indonesia:**\n' +
        'Klik tombol di bawah ini untuk mengambil atau melepas role pilihanmu.\n' +
        '*Klik sekali untuk mengambil role, klik lagi untuk melepasnya.*\n\n' +
        '**Games:** Mobile Legends, Minecraft, Roblox, Valorant, Other Games\n' +
        '**Style & Language:** Competitive Gamer, Casual Gamer, Indonesian, English'
      )
      .setFooter({ text: 'Ryo And The Gank • Self-Assignable Roles' })
      .setTimestamp();

    // Row 1: Game Roles
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_toggle:Mobile Legends').setLabel('Mobile Legends').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role_toggle:Minecraft').setLabel('Minecraft').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('role_toggle:Roblox').setLabel('Roblox').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('role_toggle:Valorant').setLabel('Valorant').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('role_toggle:Other Games').setLabel('Other Games').setStyle(ButtonStyle.Secondary)
    );

    // Row 2: Gamer Style & Languages
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_toggle:Competitive Gamer').setLabel('Competitive Gamer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role_toggle:Casual Gamer').setLabel('Casual Gamer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('role_toggle:Indonesian').setLabel('Indonesian').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_toggle:English').setLabel('English').setStyle(ButtonStyle.Secondary)
    );

    try {
      await targetChannel.send({
        embeds: [embed],
        components: [row1, row2]
      });

      return interaction.reply({
        content: `Role selection menu sent to ${targetChannel}.`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Error sending role menu:', err);
      return interaction.reply({
        content: `Failed to send role menu: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
