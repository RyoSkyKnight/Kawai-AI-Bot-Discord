const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'announce',
    description: 'Send an announcement to a channel (with optional @everyone / @here tag)',
    default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [
      {
        name: 'message',
        type: 3,
        description: 'Announcement message content',
        required: true,
      },
      {
        name: 'channel',
        type: 7,
        description: 'Target channel (defaults to current channel if omitted)',
        required: false,
      },
      {
        name: 'title',
        type: 3,
        description: 'Announcement title (defaults to 📢 Announcement)',
        required: false,
      },
      {
        name: 'ping',
        type: 3,
        description: 'Mention @everyone or @here',
        required: false,
        choices: [
          { name: '@everyone', value: 'everyone' },
          { name: '@here', value: 'here' },
          { name: 'None', value: 'none' },
        ],
      },
      {
        name: 'ping_everyone',
        type: 5,
        description: 'Legacy shortcut to ping @everyone',
        required: false,
      },
    ],
  },
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Announcements can only be sent in a server.', ephemeral: true });
      return;
    }

    // 1. Check user ManageMessages permission (guild owner is exempt)
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    if (!isOwner && !interaction.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: "Access denied: You do not have the 'Manage Messages' permission to send announcements.",
        ephemeral: true,
      });
      return;
    }

    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || '📢 Announcement';
    const pingChoice = interaction.options.getString('ping');
    const legacyPing = interaction.options.getBoolean('ping_everyone');
    const shouldPingEveryone = pingChoice === 'everyone' || legacyPing === true;
    const shouldPingHere = pingChoice === 'here';

    // 2. Strict permission check: MentionEveryone
    if ((shouldPingEveryone || shouldPingHere) && !isOwner && !interaction.member?.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      await interaction.reply({
        content: "Access denied: You do not have the 'Mention Everyone' permission in this server to tag @everyone or @here.",
        ephemeral: true,
      });
      return;
    }

    if (!channel || typeof channel.send !== 'function') {
      await interaction.reply({ content: 'Invalid target channel or channel cannot receive messages.', ephemeral: true });
      return;
    }

    // 3. Check bot permissions in target channel
    const botMember = interaction.guild.members.me;
    const botPerms = channel.permissionsFor ? channel.permissionsFor(botMember) : null;
    if (botPerms) {
      if (!botPerms.has(PermissionFlagsBits.SendMessages) || !botPerms.has(PermissionFlagsBits.EmbedLinks)) {
        await interaction.reply({ content: `I am missing permission to send messages or embed links in <#${channel.id}>.`, ephemeral: true });
        return;
      }
      if ((shouldPingEveryone || shouldPingHere) && !botPerms.has(PermissionFlagsBits.MentionEveryone)) {
        await interaction.reply({ content: `I am missing the 'Mention Everyone' permission in <#${channel.id}> to ping @everyone / @here.`, ephemeral: true });
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(title)
      .setDescription(message)
      .setFooter({
        text: `Announced by ${interaction.user.tag}`,
        iconURL: typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true }) : undefined,
      })
      .setTimestamp();

    const mentionContent = shouldPingEveryone ? '@everyone' : (shouldPingHere ? '@here' : null);

    try {
      await channel.send({
        content: mentionContent,
        embeds: [embed],
        allowedMentions: {
          parse: shouldPingEveryone || shouldPingHere ? ['everyone'] : [],
        },
      });

      await interaction.reply({ content: `Announcement successfully sent to <#${channel.id}>.`, ephemeral: true });
    } catch (error) {
      console.error('Failed to send announcement:', error);
      await interaction.reply({ content: `Failed to send announcement: ${error.message || 'Unknown error'}`, ephemeral: true });
    }
  },
};
