const { PermissionFlagsBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addWarning, getWarnings, clearWarnings, logModAction, getModStats } = require('./moderation');
const { sendLog } = require('./logChannel');
const { parseDuration, formatDuration } = require('../utils/duration');
const { getGuildSettings, updateGuildSettings } = require('./guildSettings');
const { getAutoMuteSettings, updateAutoMuteSettings } = require('./autoMute');
const { getBadWords, addBadWord, removeBadWord } = require('./badWords');
const { clearHistory } = require('./conversationHistory');
const { eightBallResponses, PERSONALITIES } = require('../utils/constants');
const math = require('mathjs');
const state = require('../state');

const PERMISSION_NAMES = {
  [PermissionFlagsBits.KickMembers]: 'Kick Members',
  [PermissionFlagsBits.BanMembers]: 'Ban Members',
  [PermissionFlagsBits.ModerateMembers]: 'Moderate Members (Mute/Timeout/Warn)',
  [PermissionFlagsBits.ManageMessages]: 'Manage Messages',
  [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
  [PermissionFlagsBits.ManageRoles]: 'Manage Roles',
  [PermissionFlagsBits.ManageGuild]: 'Manage Server (Manage Guild)',
  [PermissionFlagsBits.ManageNicknames]: 'Manage Nicknames',
  [PermissionFlagsBits.MentionEveryone]: 'Mention Everyone',
  [PermissionFlagsBits.Administrator]: 'Administrator',
};

function getMemberPermissions(interaction) {
  if (interaction.memberPermissions) {
    return interaction.memberPermissions;
  }
  const rawPerms = interaction.member?.permissions;
  if (rawPerms) {
    if (typeof rawPerms.has === 'function') return rawPerms;
    try {
      return new PermissionsBitField(BigInt(rawPerms));
    } catch (_) {}
  }
  return null;
}

function hasPermission(interaction, permission) {
  if (!interaction.guild) return false;
  if (interaction.user && interaction.guild.ownerId === interaction.user.id) return true;
  const perms = getMemberPermissions(interaction);
  return perms ? perms.has(permission) : false;
}

// Pull a Discord snowflake out of a raw string or a <@id> / <@!id> mention.
function extractUserId(raw) {
  if (!raw) return null;
  const match = String(raw).match(/\d{17,20}/);
  return match ? match[0] : null;
}

async function resolveTarget(interaction, userIdRaw) {
  if (!userIdRaw) return { error: 'Target user was not specified. Please mention or provide a user ID.' };
  const userId = extractUserId(userIdRaw);
  if (userId) {
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    const member = interaction.guild ? await interaction.guild.members.fetch(userId).catch(() => null) : null;
    if (user) return { user, member };
  }

  // Fallback: search guild members by username, nickname, or tag
  if (interaction.guild && typeof userIdRaw === 'string') {
    const query = userIdRaw.replace(/^@/, '').toLowerCase().trim();
    if (query) {
      let match = null;
      if (typeof interaction.guild.members.cache?.find === 'function') {
        match = interaction.guild.members.cache.find((m) =>
          m.user?.username?.toLowerCase() === query ||
          m.displayName?.toLowerCase() === query ||
          m.user?.tag?.toLowerCase() === query
        );
      }
      if (!match && typeof interaction.guild.members.search === 'function') {
        try {
          const searched = await interaction.guild.members.search({ query, limit: 1 });
          match = searched?.first ? searched.first() : null;
        } catch (_) {}
      }
      if (match) {
        return { user: match.user, member: match };
      }
    }
  }

  return { error: 'Target user was not found. Please provide a valid @mention or user ID.' };
}

function extractChannelId(raw) {
  if (!raw) return null;
  const match = String(raw).match(/\d{17,20}/);
  return match ? match[0] : null;
}

async function resolveChannel(interaction, channelRaw) {
  if (!interaction.guild) return null;
  if (!channelRaw) return interaction.channel;

  const channelId = extractChannelId(channelRaw);
  if (channelId) {
    let ch = interaction.guild.channels.cache.get(channelId);
    if (!ch && interaction.client) {
      ch = await interaction.client.channels.fetch(channelId).catch(() => null);
    }
    if (ch) return ch;
  }

  // Fallback: search by name
  if (typeof channelRaw === 'string') {
    const cleanName = channelRaw.replace(/^#/, '').toLowerCase().trim();
    if (cleanName === 'here' || cleanName === 'this' || cleanName === 'ini' || cleanName === 'current' || cleanName === 'channel ini' || cleanName === 'this channel') {
      return interaction.channel;
    }
    const ch = interaction.guild.channels.cache.find(
      (c) => c.name.toLowerCase() === cleanName || c.name.toLowerCase().replace(/[-_]/g, ' ') === cleanName.replace(/[-_]/g, ' ')
    );
    if (ch) return ch;
  }

  return interaction.channel;
}

function resolveRole(interaction, roleRaw) {
  if (!interaction.guild || !roleRaw) return null;
  const roleId = String(roleRaw).replace(/[<@&>]/g, '').trim();
  let role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    const query = String(roleRaw).toLowerCase().replace(/^@/, '').trim();
    role = interaction.guild.roles.cache.find(
      r => r.name.toLowerCase() === query || r.name.toLowerCase().includes(query)
    );
  }
  return role;
}

// Role hierarchy & self/owner protection rules.
function checkHierarchy(interaction, member, botMember, action = null) {
  if (!member) return null;
  const guild = interaction.guild;
  if (!guild) return null;

  // 1. Cannot moderate the server owner
  if (member.id === guild.ownerId) {
    return "Cannot perform moderation actions against the server Owner.";
  }

  // 2. Cannot moderate the bot itself
  if (member.id === botMember?.id || member.id === interaction.client?.user?.id) {
    return "I cannot perform moderation actions against myself!";
  }

  // 3. User cannot moderate themselves
  if (member.id === interaction.user.id) {
    return "You cannot perform moderation actions against yourself!";
  }

  // 4. Bot permission & role hierarchy check
  if (action === 'kick' && !member.kickable) {
    return "I cannot kick this user because their role is equal to or higher than my highest role.";
  }
  if (action === 'ban' && !member.bannable) {
    return "I cannot ban this user because their role is equal to or higher than my highest role.";
  }
  if ((action === 'timeout' || action === 'mute') && !member.moderatable) {
    return "I cannot mute/timeout this user because their role is equal to or higher than my highest role.";
  }
  if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
    return "I cannot do that — their highest role is equal to or above my highest role.";
  }

  // 5. Invoking user role hierarchy check (guild owner is exempt)
  if (interaction.user.id !== guild.ownerId && interaction.member) {
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return "You cannot do that — the target's highest role is equal to or higher than yours.";
    }
  }

  return null;
}

const tools = {
  get_warnings: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'get_warnings',
        description: "Look up a Discord user's warning history in this server.",
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention, e.g. <@123456789012345678>' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const { user, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      const warnings = await getWarnings(interaction.guild.id, user.id);
      return {
        ok: true,
        message: warnings.length === 0
          ? `${user.tag} has no warnings.`
          : `${user.tag} has ${warnings.length} warning(s): ${warnings.map((w, i) => `${i + 1}) ${w.reason}`).join('; ')}`,
      };
    },
  },

  warn_user: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'warn_user',
        description: 'Issue a moderation warning to a user in this server.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            reason: { type: 'string', description: 'Reason for the warning' },
          },
          required: ['userId', 'reason'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { ok: false, message: "I'm missing the Moderate Members permission in this server." };
      }

      const { user, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      await addWarning(interaction.guild.id, user.id, args.reason, interaction.user.id);
      const warnings = await getWarnings(interaction.guild.id, user.id);
      await logModAction(interaction.guild.id, 'warn', interaction.user.id, user.id, args.reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('User Warned (via Cutie AI)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Total Warnings', value: warnings.length.toString(), inline: true },
          { name: 'Reason', value: args.reason, inline: false }
        )
        .setTimestamp();

      const warnActionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mod_clearwarn:${user.id}`)
          .setLabel('Clear Warnings')
          .setStyle(ButtonStyle.Secondary)
      );

      await sendLog(interaction.guild, embed, [warnActionRow]);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});
      try {
        await user.send({ embeds: [embed] });
      } catch (_) {
        // User has DMs disabled
      }

      return { ok: true, message: `Warned ${user.tag}. They now have ${warnings.length} total warning(s).` };
    },
  },

  clear_warnings: {
    permission: PermissionFlagsBits.Administrator,
    definition: {
      type: 'function',
      function: {
        name: 'clear_warnings',
        description: 'Clear all warnings for a user. Requires Administrator permission.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.Administrator)) {
        return { ok: false, message: "I'm missing the Administrator permission in this server." };
      }

      const { user, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      await clearWarnings(interaction.guild.id, user.id);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('Warnings Cleared (via Cutie AI)')
        .setDescription(`All warnings for ${user.tag} have been cleared.`)
        .setFooter({ text: `Cleared by ${interaction.user.tag}` })
        .setTimestamp();
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Cleared all warnings for ${user.tag}.` };
    },
  },

  timeout_user: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'timeout_user',
        description: 'Timeout (temporarily mute) a user in the server (e.g. "timeout @user 10m", "mute @user 1h"). Maximum duration is 28 days.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            duration: { type: 'string', description: 'Duration like 10m, 1h, 1d (defaults to 10m if omitted)' },
            reason: { type: 'string', description: 'Reason for the timeout/mute' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { ok: false, message: "I am missing the Moderate Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const hierarchyError = checkHierarchy(interaction, member, botMember, 'timeout');
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const rawDuration = args.duration || args.time || '10m';
      const ms = parseDuration(rawDuration);
      if (!ms || ms > 2419200000) {
        return { ok: false, message: 'Invalid timeout duration. Use formats like 10m, 1h, 1d (maximum 28 days).' };
      }

      const reason = args.reason || 'Timed out via Cutie AI';
      await member.timeout(ms, reason);
      await logModAction(interaction.guild.id, 'timeout', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('User Timed Out (via Cutie AI)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Duration', value: formatDuration(ms, 'en'), inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      const timeoutActionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mod_untimeout:${user.id}`)
          .setLabel('Unmute / Remove Timeout')
          .setStyle(ButtonStyle.Success)
      );

      await sendLog(interaction.guild, embed, [timeoutActionRow]);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Successfully timed out/muted ${user.tag} for ${formatDuration(ms, 'en')}.` };
    },
  },

  mute_user: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'mute_user',
        description: 'Mute / timeout a user in the server (e.g. "mute @user 10m", "mute @user 1h"). Alias for timeout_user.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            duration: { type: 'string', description: 'Duration like 10m, 1h, 1d (defaults to 10m if omitted)' },
            reason: { type: 'string', description: 'Reason for the mute' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      return await tools.timeout_user.handler(interaction, args);
    },
  },

  untimeout_user: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'untimeout_user',
        description: 'Remove timeout / unmute a user in the server (e.g. "unmute @user", "remove timeout @user").',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            reason: { type: 'string', description: 'Reason for removing timeout / unmute' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { ok: false, message: "I am missing the Moderate Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const hierarchyError = checkHierarchy(interaction, member, botMember, 'untimeout');
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const reason = args.reason || 'Timeout removed via Cutie AI';
      await member.timeout(null, reason);
      await logModAction(interaction.guild.id, 'untimeout', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('Timeout Removed (via Cutie AI)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Successfully removed timeout/mute for ${user.tag}.` };
    },
  },

  unmute_user: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'unmute_user',
        description: 'Unmute a user in the server (alias for untimeout_user).',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            reason: { type: 'string', description: 'Reason for unmute' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      return await tools.untimeout_user.handler(interaction, args);
    },
  },

  kick_user: {
    permission: PermissionFlagsBits.KickMembers,
    definition: {
      type: 'function',
      function: {
        name: 'kick_user',
        description: 'Kick a user from the server (e.g. "kick @user [reason]").',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            reason: { type: 'string', description: 'Reason for the kick' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
        return { ok: false, message: "I am missing the Kick Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const hierarchyError = checkHierarchy(interaction, member, botMember, 'kick');
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const reason = args.reason || 'Kicked via Cutie AI';
      await member.kick(reason);
      await logModAction(interaction.guild.id, 'kick', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('User Kicked (via Cutie AI)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Successfully kicked ${user.tag} from the server.` };
    },
  },

  ban_user: {
    permission: PermissionFlagsBits.BanMembers,
    definition: {
      type: 'function',
      function: {
        name: 'ban_user',
        description: 'Ban a user from the server (e.g. "ban @user [reason]").',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            reason: { type: 'string', description: 'Reason for the ban' },
            deleteMessageDays: { type: 'integer', description: 'Delete messages from the last X days (0-7)' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
        return { ok: false, message: "I am missing the Ban Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      if (member) {
        const hierarchyError = checkHierarchy(interaction, member, botMember, 'ban');
        if (hierarchyError) return { ok: false, message: hierarchyError };
      }

      const reason = args.reason || 'Banned via Cutie AI';
      const deleteDays = Math.min(Math.max(parseInt(args.deleteMessageDays, 10) || 0, 0), 7);

      await interaction.guild.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
      await logModAction(interaction.guild.id, 'ban', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('User Banned (via Cutie AI)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Successfully banned ${user.tag} from the server.` };
    },
  },

  unban_user: {
    permission: PermissionFlagsBits.BanMembers,
    definition: {
      type: 'function',
      function: {
        name: 'unban_user',
        description: 'Unban a user from the server by user ID or username.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention or username of the banned user' },
            reason: { type: 'string', description: 'Reason for the unban' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
        return { ok: false, message: "I am missing the Ban Members permission in this server." };
      }

      let targetId = extractUserId(args.userId);
      let targetTag = args.userId;

      if (!targetId && interaction.guild) {
        try {
          const bans = await interaction.guild.bans.fetch();
          const query = String(args.userId).replace(/^@/, '').toLowerCase().trim();
          const match = bans.find(b => b.user.username.toLowerCase() === query || b.user.tag.toLowerCase() === query);
          if (match) {
            targetId = match.user.id;
            targetTag = match.user.tag;
          }
        } catch (_) {}
      }

      if (!targetId) {
        return { ok: false, message: 'Could not find a banned user with that ID or name. Please provide a valid user ID.' };
      }

      const reason = args.reason || 'Unbanned via Cutie AI';

      try {
        await interaction.guild.members.unban(targetId, reason);
        await logModAction(interaction.guild.id, 'unban', interaction.user.id, targetId, reason);

        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('User Unbanned (via Cutie AI)')
          .addFields(
            { name: 'User', value: `${targetTag} (${targetId})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await sendLog(interaction.guild, embed);
        await interaction.followUp({ embeds: [embed] }).catch(() => {});

        return { ok: true, message: `Successfully unbanned ${targetTag} (${targetId}) from the server.` };
      } catch (err) {
        return { ok: false, message: `Failed to unban user: ${err.message || 'ID was not found in the server ban list.'}` };
      }
    },
  },

  get_mod_stats: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'get_mod_stats',
        description: 'Get a summary of moderation action counts in this server.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      const logs = await getModStats(interaction.guild.id);
      const stats = {};
      logs.forEach((l) => {
        stats[l.action] = (stats[l.action] || 0) + 1;
      });
      const summary = Object.entries(stats).map(([a, c]) => `${a}: ${c}`).join(', ') || 'No actions recorded.';
      return { ok: true, message: `Total moderation actions logged: ${logs.length}. Breakdown — ${summary}` };
    },
  },

  get_user_profile: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_user_profile',
        description: "Get detailed profile information about a Discord user, such as username, ID, bot status, server join date, and roles.",
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention, e.g. <@123456789012345678>' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      const info = {
        username: user.username,
        id: user.id,
        isBot: user.bot,
        avatarUrl: user.displayAvatarURL({ size: 512 }),
        accountCreatedTimestamp: user.createdTimestamp,
        accountCreatedDate: user.createdAt.toUTCString(),
      };

      if (member) {
        info.joinedServerTimestamp = member.joinedTimestamp;
        info.joinedServerDate = member.joinedAt ? member.joinedAt.toUTCString() : 'N/A';
        info.roles = member.roles.cache.map(r => r.name).filter(name => name !== '@everyone');
      }

      return { ok: true, data: info };
    },
  },

  get_user_avatar: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_user_avatar',
        description: "Get the avatar image URL of a Discord user.",
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const { user, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      return {
        ok: true,
        data: {
          username: user.username,
          avatarUrl: user.displayAvatarURL({ size: 1024, dynamic: true }),
        }
      };
    },
  },

  get_server_info: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_server_info',
        description: "Get detailed information about the current Discord server.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      const guild = interaction.guild;
      if (!guild) return { ok: false, message: 'This tool can only be used in a server.' };

      const owner = await interaction.client.users.fetch(guild.ownerId).catch(() => null);

      return {
        ok: true,
        data: {
          name: guild.name,
          id: guild.id,
          ownerName: owner ? owner.username : 'Unknown',
          ownerId: guild.ownerId,
          memberCount: guild.memberCount,
          createdTimestamp: guild.createdTimestamp,
          createdDate: guild.createdAt.toUTCString(),
          channelsCount: guild.channels.cache.size,
          rolesCount: guild.roles.cache.size,
          verificationLevel: guild.verificationLevel,
          boostLevel: guild.premiumTier,
          boostCount: guild.premiumSubscriptionCount || 0,
        }
      };
    },
  },

  get_bot_info: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_bot_info',
        description: "Get general information and status of this bot (Kawai Ai).",
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      const client = interaction.client;
      const uptimeMs = Date.now() - state.startTime;
      const { CREATOR_ID } = require('../config');
      const { formatDuration } = require('../utils/duration');

      const creatorUser = await client.users.fetch(CREATOR_ID).catch(() => null);

      return {
        ok: true,
        data: {
          botName: client.user.username,
          botId: client.user.id,
          creatorName: creatorUser ? creatorUser.username : 'my amazing creator',
          creatorId: CREATOR_ID,
          serverCount: client.guilds.cache.size,
          userCount: client.users.cache.size,
          uptime: formatDuration(uptimeMs),
          pingMs: client.ws.ping,
          nodeVersion: process.version,
          discordJsVersion: require('discord.js').version,
        }
      };
    },
  },

  ping: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'ping',
        description: 'Check bot connection latency and Discord WebSocket ping (e.g. "ping", "cek ping", "pong", "latensi bot").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      const pingMs = Math.round(interaction.client?.ws?.ping || 0);
      return {
        ok: true,
        pingMs,
        message: `Pong! Discord WebSocket ping latency is ${pingMs}ms.`,
      };
    },
  },

  get_weather: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_weather',
        description: "Get current weather information for a specific city.",
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'Name of the city, e.g. London, Jakarta, Tokyo' },
          },
          required: ['city'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const response = await fetch(`https://wttr.in/${encodeURIComponent(args.city)}?format=j1`);
        if (!response.ok) return { ok: false, message: 'City not found or weather service unavailable.' };
        const data = await response.json();
        if (!data.current_condition || data.current_condition.length === 0) {
          return { ok: false, message: 'Weather data not available for this city.' };
        }
        const current = data.current_condition[0];
        return {
          ok: true,
          data: {
            city: args.city,
            temp_C: current.temp_C,
            temp_F: current.temp_F,
            feelsLike_C: current.FeelsLikeC,
            feelsLike_F: current.FeelsLikeF,
            condition: current.weatherDesc[0].value,
            humidity: current.humidity,
            windSpeedKmph: current.windspeedKmph,
            precipitationMm: current.precipMM
          }
        };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch weather data.' };
      }
    },
  },

  wikipedia_search: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'wikipedia_search',
        description: "Search Wikipedia for a summary of a topic.",
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term or topic, e.g. Quantum Computing' },
          },
          required: ['query'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.query)}`);
        if (!response.ok) return { ok: false, message: 'No Wikipedia article found.' };
        const data = await response.json();
        return {
          ok: true,
          data: {
            title: data.title,
            extract: data.extract,
            url: data.content_urls?.desktop?.page
          }
        };
      } catch (err) {
        return { ok: false, message: 'Wikipedia search failed.' };
      }
    },
  },

  get_crypto_price: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_crypto_price',
        description: "Get the current spot price of a cryptocurrency in USD.",
        parameters: {
          type: 'object',
          properties: {
            coin: { type: 'string', description: 'Cryptocurrency symbol, e.g. BTC, ETH, SOL' },
          },
          required: ['coin'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const coin = args.coin.toUpperCase();
        const response = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`);
        const data = await response.json();
        if (data.errors) return { ok: false, message: 'Cryptocurrency not found.' };
        return { ok: true, data: { coin, priceUsd: parseFloat(data.data.amount) } };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch crypto price.' };
      }
    },
  },

  get_joke: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_joke',
        description: "Get a random funny joke.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      try {
        const response = await fetch('https://official-joke-api.appspot.com/random_joke');
        if (!response.ok) return { ok: false, message: 'Failed to fetch joke.' };
        const data = await response.json();
        return { ok: true, data: { setup: data.setup, punchline: data.punchline } };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch joke.' };
      }
    },
  },

  get_meme: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_meme',
        description: "Get a random internet meme image.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      try {
        const response = await fetch('https://meme-api.com/gimme');
        if (!response.ok) return { ok: false, message: 'Failed to fetch meme.' };
        const data = await response.json();
        return { ok: true, data: { title: data.title, url: data.url, subreddit: data.subreddit } };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch meme.' };
      }
    },
  },

  get_anime_info: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_anime_info',
        description: "Get detailed information about an anime using its title.",
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Title of the anime to search for' },
          },
          required: ['title'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(args.title)}&limit=1`);
        if (!response.ok) return { ok: false, message: 'Failed to fetch anime data.' };
        const data = await response.json();
        if (!data.data || data.data.length === 0) return { ok: false, message: 'Anime not found.' };
        const anime = data.data[0];
        return {
          ok: true,
          data: {
            title: anime.title,
            episodes: anime.episodes,
            score: anime.score,
            status: anime.status,
            type: anime.type,
            year: anime.year,
            rating: anime.rating,
            synopsis: anime.synopsis,
            url: anime.url
          }
        };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch anime info.' };
      }
    },
  },

  get_movie_info: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_movie_info',
        description: "Get detailed information about a movie using its title.",
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Title of the movie to search for' },
          },
          required: ['title'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const response = await fetch(`https://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(args.title)}`);
        if (!response.ok) return { ok: false, message: 'Failed to fetch movie data.' };
        const data = await response.json();
        if (data.Response === 'False') return { ok: false, message: 'Movie not found.' };
        return {
          ok: true,
          data: {
            title: data.Title,
            year: data.Year,
            imdbRating: data.imdbRating,
            runtime: data.Runtime,
            genre: data.Genre,
            director: data.Director,
            actors: data.Actors,
            plot: data.Plot,
            poster: data.Poster !== 'N/A' ? data.Poster : null
          }
        };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch movie info.' };
      }
    },
  },

  calculate: {
    permission: null, // Public utility tool
    definition: {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform exact mathematical calculations or evaluate math expressions (e.g. "25 * 40", "sqrt(144)", "15% of 200").',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'The mathematical expression to evaluate, e.g. "25 * 40", "sqrt(16) + 10".',
            },
          },
          required: ['expression'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const result = math.evaluate(args.expression);
        return { ok: true, message: `Result of ${args.expression} = ${result}` };
      } catch (err) {
        return { ok: false, message: `Failed to evaluate expression: ${err.message}` };
      }
    },
  },

  set_reminder: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'set_reminder',
        description: "Set a countdown timer or reminder for the user. Call this tool whenever the user asks to be reminded of something, set a timer, or count down time (e.g. 'remind me in 1 hour', 'set timer 15s', 'remind me in 10 minutes').",
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'string', description: 'Duration or time, e.g. "15s", "10s", "1m", "5m", "1h"' },
            seconds: { type: 'integer', description: 'Number of seconds directly (e.g. 15)' },
            minutes: { type: 'number', description: 'Number of minutes directly (e.g. 1)' },
            time: { type: 'string', description: 'Alias for duration' },
            message: { type: 'string', description: 'What to remind the user about (e.g. "hot chocolate", "take vitamins"). Defaults to "Time is up!" if not provided.' },
          },
        },
      },
    },
    async handler(interaction, args) {
      let ms = null;
      if (args.seconds !== undefined && args.seconds !== null && !isNaN(Number(args.seconds)) && Number(args.seconds) > 0) {
        ms = Math.round(Number(args.seconds) * 1000);
      } else if (args.minutes !== undefined && args.minutes !== null && !isNaN(Number(args.minutes)) && Number(args.minutes) > 0) {
        ms = Math.round(Number(args.minutes) * 60000);
      } else {
        const rawTime = args.duration || args.time || args.seconds || args.minutes;
        ms = parseDuration(rawTime);
      }

      if (!ms || ms <= 0) {
        return { ok: false, message: 'Invalid duration format. Use formats like 15s, 10s, 1m, 5m, 1h.' };
      }
      if (ms > 24 * 60 * 60 * 1000 * 30) {
        return { ok: false, message: 'Maximum reminder duration is 30 days.' };
      }

      const user = interaction.user;
      const client = interaction.client;
      const channelId = interaction.channelId || interaction.channel?.id;
      const reminderMsg = args.message && args.message.trim() ? args.message.trim() : 'Time is up!';
      const timeStr = formatDuration(ms, 'en');

      console.log(`[Timer] Scheduling persistent reminder for user ${user?.id} in ${ms}ms (${timeStr}): "${reminderMsg}" in channel ${channelId}`);

      const reminderManager = require('./reminderManager');
      reminderManager.addReminder({
        userId: user.id,
        channelId,
        targetTimestamp: Date.now() + ms,
        timeStr,
        message: reminderMsg,
      }, client);

      return {
        ok: true,
        duration: timeStr,
        note: reminderMsg,
        message: `Reminder for "${reminderMsg}" in ${timeStr} successfully scheduled! Timer is actively counting down.`,
      };
    },
  },

  set_timer: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'set_timer',
        description: "Set a countdown timer or reminder. Call this tool whenever the user asks to set a timer, countdown, or be reminded (e.g. 'set timer 15s', 'set timer 1 minute', 'countdown 10s').",
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'string', description: 'Duration or time, e.g. "15s", "10s", "1m", "5m", "1h"' },
            seconds: { type: 'integer', description: 'Number of seconds directly (e.g. 15)' },
            minutes: { type: 'number', description: 'Number of minutes directly (e.g. 1)' },
            time: { type: 'string', description: 'Alias for duration' },
            message: { type: 'string', description: 'Note for the timer. Defaults to "Time is up!" if not provided.' },
          },
        },
      },
    },
    async handler(interaction, args) {
      return await tools.set_reminder.handler(interaction, args);
    },
  },

  choose_option: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'choose_option',
        description: 'Choose randomly between multiple options when the user is undecided (e.g. "pilihin makan apa: sate, bakso, nasgor", "choose between movie or gaming").',
        parameters: {
          type: 'object',
          properties: {
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of choices to pick from, e.g. ["sate", "bakso", "nasgor"]',
            },
          },
          required: ['options'],
        },
      },
    },
    async handler(interaction, args) {
      let opts = args.options;
      if (typeof opts === 'string') {
        opts = opts.split(/,| atau | or /i).map(s => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(opts) || opts.length < 2) {
        return { ok: false, message: 'Please provide at least 2 options to choose from!' };
      }
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      return { ok: true, chosen, allOptions: opts, message: `From the choices (${opts.join(', ')}), my pick is: ${chosen}.` };
    },
  },

  flip_coin: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'flip_coin',
        description: 'Flip a coin and get Heads or Tails (e.g. "lempar koin dong", "toss coin").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      const isHeads = Math.random() < 0.5;
      const result = isHeads ? 'Heads' : 'Tails';
      return { ok: true, result, isHeads };
    },
  },

  roll_dice: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'roll_dice',
        description: 'Roll a dice with a specified number of sides (e.g. "roll dadu", "roll dadu d20", "roll dice 1-100").',
        parameters: {
          type: 'object',
          properties: {
            sides: { type: 'integer', description: 'Number of sides on the dice (default: 6, min: 2, max: 1000)' },
          },
        },
      },
    },
    async handler(interaction, args) {
      const sides = Math.max(2, Math.min(parseInt(args.sides, 10) || 6, 1000));
      const roll = Math.floor(Math.random() * sides) + 1;
      return { ok: true, roll, sides, message: `Dice roll (${sides} sides): ${roll}` };
    },
  },

  create_poll: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'create_poll',
        description: 'Create an interactive voting poll in the channel with number reaction emojis (e.g. "bikinin polling: mabar apa malam ini? pilihannya: ML, Valo, FF").',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The poll question or topic' },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of 2 to 10 choices/options',
            },
          },
          required: ['question', 'options'],
        },
      },
    },
    async handler(interaction, args) {
      const channel = interaction.channel;
      if (!channel || !channel.send) {
        return { ok: false, message: 'Cannot create a poll in this channel.' };
      }
      let opts = args.options;
      if (typeof opts === 'string') {
        opts = opts.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(opts) || opts.length < 2) {
        return { ok: false, message: 'Poll requires at least 2 options.' };
      }
      if (opts.length > 10) {
        opts = opts.slice(0, 10);
      }

      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('Poll')
        .setDescription(`**${args.question}**\n\n` + opts.map((opt, i) => `${numberEmojis[i]} ${opt}`).join('\n'))
        .setFooter({ text: `Created by ${interaction.user?.username || 'User'}` })
        .setTimestamp();

      try {
        const pollMsg = await channel.send({ embeds: [embed] });
        for (let i = 0; i < opts.length; i++) {
          await pollMsg.react(numberEmojis[i]).catch(() => {});
        }
        return { ok: true, message: `Poll "${args.question}" with ${opts.length} options successfully created in channel!` };
      } catch (err) {
        return { ok: false, message: `Failed to send poll: ${err.message}` };
      }
    },
  },

  manage_todo: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'manage_todo',
        description: 'Manage personal to-do list / notes for the user. Actions: "add" (add item), "list" (show items), "remove" (delete item by 1-indexed number or text), "clear" (remove all items).',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add', 'list', 'remove', 'clear'],
              description: 'The action to perform: add, list, remove, or clear',
            },
            item: {
              type: 'string',
              description: 'The task description or note (for "add") or index/text to remove (for "remove")',
            },
          },
          required: ['action'],
        },
      },
    },
    async handler(interaction, args) {
      const userId = interaction.user?.id;
      if (!userId) return { ok: false, message: 'User not identified.' };

      const todoManager = require('./todoManager');
      const action = (args.action || 'list').toLowerCase();

      if (action === 'add') {
        if (!args.item || !args.item.trim()) {
          return { ok: false, message: 'Please specify the task/note to add!' };
        }
        const updated = todoManager.addTodo(userId, args.item.trim());
        return {
          ok: true,
          message: `Successfully added to persistent to-do list: "${args.item.trim()}". You now have ${updated.length} task(s).`,
          todos: updated,
        };
      }

      if (action === 'list') {
        const todos = todoManager.getTodos(userId);
        if (todos.length === 0) {
          return { ok: true, message: 'Your to-do list is currently empty.', todos: [] };
        }
        const formatted = todos.map((t, idx) => `${idx + 1}. ${t}`).join('\n');
        return {
          ok: true,
          message: `Your persistent to-do list (${todos.length}):\n${formatted}`,
          todos,
        };
      }

      if (action === 'remove') {
        const { removed, remaining } = todoManager.removeTodo(userId, args.item);
        if (!removed) {
          return { ok: false, message: `Could not find a task matching "${args.item}".` };
        }
        return { ok: true, message: `Successfully removed task: "${removed}". ${remaining.length} task(s) remaining.`, todos: remaining };
      }

      if (action === 'clear') {
        todoManager.clearTodos(userId);
        return { ok: true, message: 'All items in your to-do list have been cleared.' };
      }

      return { ok: false, message: `Unknown action: ${action}` };
    },
  },

  clear_messages: {
    permission: PermissionFlagsBits.ManageMessages,
    definition: {
      type: 'function',
      function: {
        name: 'clear_messages',
        description: 'Bulk delete recent messages in the current channel (1-100 messages). Requires ManageMessages permission.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'integer', description: 'Number of messages to delete (1-100)' },
          },
          required: ['amount'],
        },
      },
    },
    async handler(interaction, args) {
      const channel = interaction.channel;
      if (!channel || !channel.bulkDelete) {
        return { ok: false, message: 'Messages cannot be deleted in this channel.' };
      }
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return { ok: false, message: "I'm missing the Manage Messages permission in this server." };
      }

      const amount = Math.max(1, Math.min(parseInt(args.amount, 10) || 1, 100));
      try {
        const deleted = await channel.bulkDelete(amount, true);
        return { ok: true, message: `Successfully deleted the last ${deleted.size} message(s).` };
      } catch (err) {
        return { ok: false, message: `Failed to delete messages: ${err.message}` };
      }
    },
  },

  set_slowmode: {
    permission: PermissionFlagsBits.ManageChannels,
    definition: {
      type: 'function',
      function: {
        name: 'set_slowmode',
        description: 'Set slowmode rate limit per user for the channel (0 to disable, max 6 hours). Requires ManageChannels permission.',
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'string', description: 'Duration in seconds or text like "10s", "1m", "0" to disable' },
          },
          required: ['duration'],
        },
      },
    },
    async handler(interaction, args) {
      const channel = interaction.channel;
      if (!channel || !channel.setRateLimitPerUser) {
        return { ok: false, message: 'Slowmode cannot be configured in this channel.' };
      }
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return { ok: false, message: "I'm missing the Manage Channels permission in this server." };
      }

      const raw = String(args.duration).trim().toLowerCase();
      let seconds = 0;
      if (raw === '0' || raw === 'disable' || raw === 'off' || raw === 'mati') {
        seconds = 0;
      } else {
        const ms = parseDuration(raw);
        seconds = ms ? Math.floor(ms / 1000) : (parseInt(raw, 10) || 0);
      }

      if (seconds < 0 || seconds > 21600) {
        return { ok: false, message: 'Slowmode duration must be between 0 and 21600 seconds (maximum 6 hours).' };
      }

      try {
        await channel.setRateLimitPerUser(seconds);
        return {
          ok: true,
          message: seconds === 0
            ? 'Slowmode has been disabled.'
            : `Channel slowmode has been set to ${seconds} seconds per user.`,
        };
      } catch (err) {
        return { ok: false, message: `Failed to set slowmode: ${err.message}` };
      }
    },
  },

  urban_dictionary: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'urban_dictionary',
        description: 'Look up slang words, internet terms, or modern phrases in Urban Dictionary (e.g. "arti rizz", "apa itu skibidi").',
        parameters: {
          type: 'object',
          properties: {
            term: { type: 'string', description: 'Word or slang phrase to look up' },
          },
          required: ['term'],
        },
      },
    },
    async handler(interaction, args) {
      try {
        const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(args.term)}`);
        if (!res.ok) return { ok: false, message: 'Urban Dictionary service is currently unavailable.' };
        const data = await res.json();
        if (!data.list || data.list.length === 0) {
          return { ok: false, message: `No definition found for term "${args.term}".` };
        }
        const top = data.list[0];
        return {
          ok: true,
          word: top.word,
          definition: top.definition.replace(/\[|\]/g, '').substring(0, 500),
          example: top.example ? top.example.replace(/\[|\]/g, '').substring(0, 300) : null,
          thumbsUp: top.thumbs_up,
        };
      } catch (err) {
        return { ok: false, message: `Failed to fetch definition: ${err.message}` };
      }
    },
  },

  generate_qr: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'generate_qr',
        description: 'Generate a QR code image URL for any text or link (e.g. "buatkan QR code untuk https://...").',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The text or URL to encode into QR code' },
          },
          required: ['text'],
        },
      },
    },
    async handler(interaction, args) {
      if (!args.text || !args.text.trim()) {
        return { ok: false, message: 'Please provide text or a URL to generate a QR code.' };
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(args.text.trim())}`;
      return {
        ok: true,
        qrUrl,
        message: `QR code successfully generated for: ${args.text.trim()}`,
      };
    },
  },

  get_quote: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_quote',
        description: 'Get an inspiring motivational quote (e.g. "minta kata motivasi", "quote hari ini").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      const { quotes } = require('../utils/constants');
      if (quotes && quotes.length > 0) {
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        return { ok: true, quote: q.text, author: q.author };
      }
      return { ok: true, quote: 'Believe in yourself and all that you are.', author: 'Christian D. Larson' };
    },
  },

  get_fact: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_fact',
        description: 'Get an interesting random fun fact (e.g. "kasih fakta unik", "fakta menarik hari ini").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      try {
        const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
        if (res.ok) {
          const data = await res.json();
          return { ok: true, fact: data.text };
        }
      } catch (_) {}
      return { ok: true, fact: 'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!' };
    },
  },

  set_ai_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'set_ai_channel',
        description: 'Set or remove the dedicated channel for AI auto-reply in this server. Requires ManageGuild (Manage Server) or Administrator permission.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['set', 'remove'],
              description: '"set" to set the AI channel, "remove" to disable it',
            },
            channelId: {
              type: 'string',
              description: 'The channel mention (e.g. <#123>) or channel ID. If omitted for "set", uses the current channel.',
            },
          },
          required: ['action'],
        },
      },
    },
    async handler(interaction, args) {
      if (!interaction.guild) {
        return { ok: false, message: 'This command can only be used inside a server.' };
      }
      const action = (args.action || 'set').toLowerCase();
      if (action === 'remove' || action === 'disable') {
        const success = await updateGuildSettings(interaction.guild.id, { ask_channel_id: null });
        return {
          ok: success,
          message: success
            ? 'Dedicated AI auto-reply channel has been removed. The bot will now only respond when mentioned.'
            : 'Failed to update guild settings in database.',
        };
      }

      let targetChannelId = interaction.channel?.id;
      if (args.channelId) {
        const match = String(args.channelId).match(/\d{17,20}/);
        if (match) targetChannelId = match[0];
      }

      if (!targetChannelId) {
        return { ok: false, message: 'Could not detect target channel ID.' };
      }

      const success = await updateGuildSettings(interaction.guild.id, { ask_channel_id: targetChannelId });
      return {
        ok: success,
        message: success
          ? `AI auto-reply channel has been successfully set to <#${targetChannelId}>!`
          : 'Failed to save settings to database.',
      };
    },
  },

  send_announcement: {
    permission: PermissionFlagsBits.ManageMessages,
    definition: {
      type: 'function',
      function: {
        name: 'send_announcement',
        description: 'Send an official announcement to a specified channel (or current channel), with optional @everyone or @here mentions. Requires ManageMessages permission. Pinging @everyone or @here strictly requires the MentionEveryone permission.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The content or body of the announcement.',
            },
            channel: {
              type: 'string',
              description: 'Target channel mention (e.g. <#1234567890>), channel ID, or channel name (e.g. "announcements", "pengumuman"). Defaults to current channel if omitted.',
            },
            title: {
              type: 'string',
              description: 'Title for the announcement embed (e.g. "📢 Server Announcement", "Important Notice", or custom topic). Defaults to "📢 Server Announcement".',
            },
            tag: {
              type: 'string',
              enum: ['everyone', 'here', 'none'],
              description: 'Whether to ping "@everyone", "@here", or "none" (default: "none"). Pinging everyone or here strictly requires MentionEveryone permission.',
            },
          },
          required: ['message'],
        },
      },
    },
    async handler(interaction, args) {
      if (!interaction.guild) {
        return { ok: false, message: 'Announcements can only be published inside a server.' };
      }

      const isOwner = interaction.user && interaction.guild.ownerId === interaction.user.id;

      // 1. ManageMessages check (verified also in runTool)
      if (!isOwner && !hasPermission(interaction, PermissionFlagsBits.ManageMessages)) {
        return { ok: false, message: "Access denied: You do not have the 'Manage Messages' permission in this server to send announcements." };
      }

      const rawTag = (args.tag || '').toLowerCase().trim();
      const messageContent = String(args.message || '').trim();
      const title = args.title && args.title.trim() ? args.title.trim() : '📢 Server Announcement';

      const shouldPingEveryone = rawTag === 'everyone' || messageContent.includes('@everyone');
      const shouldPingHere = rawTag === 'here' || messageContent.includes('@here');

      // 2. Strict permission check for MentionEveryone
      if ((shouldPingEveryone || shouldPingHere) && !isOwner && !hasPermission(interaction, PermissionFlagsBits.MentionEveryone)) {
        return {
          ok: false,
          message: "Access denied: You do not have the 'Mention Everyone' permission in this server to tag @everyone or @here in announcements.",
        };
      }

      // 3. Resolve target channel
      const targetChannel = await resolveChannel(interaction, args.channel);
      if (!targetChannel || typeof targetChannel.send !== 'function') {
        return { ok: false, message: 'Could not find a valid text channel to send the announcement.' };
      }

      // 4. Bot permissions check in target channel
      const botMember = interaction.guild.members.me;
      const botPerms = targetChannel.permissionsFor ? targetChannel.permissionsFor(botMember) : null;
      if (botPerms) {
        if (!botPerms.has(PermissionFlagsBits.SendMessages) || !botPerms.has(PermissionFlagsBits.EmbedLinks)) {
          return { ok: false, message: `I am missing permission to send messages or embed links in <#${targetChannel.id}>.` };
        }
        if ((shouldPingEveryone || shouldPingHere) && !botPerms.has(PermissionFlagsBits.MentionEveryone)) {
          return { ok: false, message: `I am missing the 'Mention Everyone' permission in <#${targetChannel.id}> to tag @everyone / @here.` };
        }
      }

      // Clean message body if user asked to tag everyone via tag parameter so @everyone isn't repeated awkwardly
      let cleanMessage = messageContent;
      if (rawTag === 'everyone') {
        cleanMessage = cleanMessage.replace(/@everyone/g, '').trim();
      } else if (rawTag === 'here') {
        cleanMessage = cleanMessage.replace(/@here/g, '').trim();
      }

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(title)
        .setDescription(cleanMessage)
        .setFooter({
          text: `Announced by ${interaction.user?.tag || interaction.user?.username || 'Moderator'}`,
          iconURL: typeof interaction.user?.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true }) : undefined,
        })
        .setTimestamp();

      const mentionContent = shouldPingEveryone ? '@everyone' : (shouldPingHere ? '@here' : null);

      try {
        await targetChannel.send({
          content: mentionContent,
          embeds: [embed],
          allowedMentions: {
            parse: shouldPingEveryone || shouldPingHere ? ['everyone'] : [],
          },
        });

        return {
          ok: true,
          channelId: targetChannel.id,
          tagged: shouldPingEveryone ? '@everyone' : (shouldPingHere ? '@here' : 'none'),
          message: `Announcement successfully published to <#${targetChannel.id}>${shouldPingEveryone ? ' with @everyone ping' : (shouldPingHere ? ' with @here ping' : '')}!`,
        };
      } catch (err) {
        return { ok: false, message: `Failed to broadcast announcement: ${err.message}` };
      }
    },
  },

  change_personality: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'change_personality',
        description: 'Change Cutie\'s active personality mode for this user. Valid modes: "sweet" (Sweet Companion), "tsundere" (Tsundere), "cool" (Cool & Calm), "sarcastic" (Playful Witty), "assistant" (Maid Assistant). Call this whenever the user asks to switch, change, or adopt a new persona or character style.',
        parameters: {
          type: 'object',
          properties: {
            personality: {
              type: 'string',
              enum: ['sweet', 'tsundere', 'cool', 'sarcastic', 'assistant'],
              description: 'The personality mode to adopt.',
            },
          },
          required: ['personality'],
        },
      },
    },
    async handler(interaction, args) {
      const { setUserPersonality } = require('./userPersonality');
      const { PERSONALITIES } = require('../utils/constants');

      const target = (args.personality || '').toLowerCase().trim();
      if (!PERSONALITIES[target]) {
        return { ok: false, message: `Unknown personality: "${target}". Available styles: sweet, tsundere, cool, sarcastic, assistant.` };
      }

      await setUserPersonality(interaction.user.id, target);
      return {
        ok: true,
        personality: target,
        info: PERSONALITIES[target],
        message: `Successfully switched personality to "${PERSONALITIES[target].name}" (${PERSONALITIES[target].emoji})! Now immediately reply adopting this new character persona.`,
      };
    },
  },

  lock_channel: {
    permission: PermissionFlagsBits.ManageChannels,
    definition: {
      type: 'function',
      function: {
        name: 'lock_channel',
        description: 'Lock a text channel to prevent members from sending messages (e.g. "lock channel ini", "lock #chat [reason]"). Requires ManageChannels permission.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name, ID, or mention (defaults to current channel if omitted)' },
            reason: { type: 'string', description: 'Reason for locking the channel' },
          },
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return { ok: false, message: 'I am missing the Manage Channels permission in this server.' };
      }
      const targetChannel = await resolveChannel(interaction, args.channel);
      if (!targetChannel || !targetChannel.permissionOverwrites) {
        return { ok: false, message: 'Invalid or unsupported channel for locking.' };
      }

      const reason = args.reason || 'Channel locked via Cutie AI';
      try {
        await targetChannel.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: false,
        });
        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🔒 Channel Locked')
          .setDescription(`This channel has been locked.\n**Reason:** ${reason}`)
          .setFooter({ text: `Locked by ${interaction.user.tag}` })
          .setTimestamp();

        await targetChannel.send({ embeds: [embed] }).catch(() => {});
        return { ok: true, channelId: targetChannel.id, message: `Successfully locked channel <#${targetChannel.id}>.` };
      } catch (err) {
        return { ok: false, message: `Failed to lock channel: ${err.message}` };
      }
    },
  },

  unlock_channel: {
    permission: PermissionFlagsBits.ManageChannels,
    definition: {
      type: 'function',
      function: {
        name: 'unlock_channel',
        description: 'Unlock a locked text channel so members can chat again (e.g. "unlock channel ini", "buka kunci channel"). Requires ManageChannels permission.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name, ID, or mention (defaults to current channel if omitted)' },
            reason: { type: 'string', description: 'Reason for unlocking the channel' },
          },
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return { ok: false, message: 'I am missing the Manage Channels permission in this server.' };
      }
      const targetChannel = await resolveChannel(interaction, args.channel);
      if (!targetChannel || !targetChannel.permissionOverwrites) {
        return { ok: false, message: 'Invalid or unsupported channel for unlocking.' };
      }

      const reason = args.reason || 'Channel unlocked via Cutie AI';
      try {
        await targetChannel.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: null,
        });
        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('🔓 Channel Unlocked')
          .setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
          .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
          .setTimestamp();

        await targetChannel.send({ embeds: [embed] }).catch(() => {});
        return { ok: true, channelId: targetChannel.id, message: `Successfully unlocked channel <#${targetChannel.id}>.` };
      } catch (err) {
        return { ok: false, message: `Failed to unlock channel: ${err.message}` };
      }
    },
  },

  assign_role: {
    permission: PermissionFlagsBits.ManageRoles,
    definition: {
      type: 'function',
      function: {
        name: 'assign_role',
        description: 'Give / add a role to a server member (e.g. "kasih role Gamer ke @user", "add role VIP to @user"). Requires ManageRoles permission.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            role: { type: 'string', description: 'Role name, mention, or ID to assign' },
            reason: { type: 'string', description: 'Reason for assigning the role' },
          },
          required: ['userId', 'role'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return { ok: false, message: 'I am missing the Manage Roles permission in this server.' };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const role = resolveRole(interaction, args.role);
      if (!role) {
        return { ok: false, message: `Role "${args.role}" was not found in this server.` };
      }

      if (role.position >= botMember.roles.highest.position) {
        return { ok: false, message: `I cannot assign the "${role.name}" role because it is positioned higher than or equal to my highest role.` };
      }
      if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return { ok: false, message: `You cannot assign the "${role.name}" role because it is positioned higher than or equal to your highest role.` };
      }

      if (member.roles.cache.has(role.id)) {
        return { ok: false, message: `${user.tag} already has the "${role.name}" role!` };
      }

      const reason = args.reason || `Assigned by ${interaction.user.tag} via Cutie AI`;
      try {
        await member.roles.add(role, reason);
        return { ok: true, message: `Successfully assigned role **${role.name}** to ${user.tag}.` };
      } catch (err) {
        return { ok: false, message: `Failed to assign role: ${err.message}` };
      }
    },
  },

  remove_role: {
    permission: PermissionFlagsBits.ManageRoles,
    definition: {
      type: 'function',
      function: {
        name: 'remove_role',
        description: 'Remove a role from a server member (e.g. "cabut role VIP dari @user", "remove role Gamer from @user"). Requires ManageRoles permission.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            role: { type: 'string', description: 'Role name, mention, or ID to remove' },
            reason: { type: 'string', description: 'Reason for removing the role' },
          },
          required: ['userId', 'role'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return { ok: false, message: 'I am missing the Manage Roles permission in this server.' };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const role = resolveRole(interaction, args.role);
      if (!role) {
        return { ok: false, message: `Role "${args.role}" was not found in this server.` };
      }

      if (role.position >= botMember.roles.highest.position) {
        return { ok: false, message: `I cannot remove the "${role.name}" role because it is positioned higher than or equal to my highest role.` };
      }
      if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return { ok: false, message: `You cannot remove the "${role.name}" role because it is positioned higher than or equal to your highest role.` };
      }

      if (!member.roles.cache.has(role.id)) {
        return { ok: false, message: `${user.tag} does not have the "${role.name}" role!` };
      }

      const reason = args.reason || `Removed by ${interaction.user.tag} via Cutie AI`;
      try {
        await member.roles.remove(role, reason);
        return { ok: true, message: `Successfully removed role **${role.name}** from ${user.tag}.` };
      } catch (err) {
        return { ok: false, message: `Failed to remove role: ${err.message}` };
      }
    },
  },

  create_role: {
    permission: PermissionFlagsBits.ManageRoles,
    definition: {
      type: 'function',
      function: {
        name: 'create_role',
        description: 'Create a new role in the server (e.g. "buatkan role baru namanya VIP warnanya #FFD700"). Requires ManageRoles permission.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the new role' },
            color: { type: 'string', description: 'Color hex code, e.g. "#FF0000", "#3498DB"' },
            hoist: { type: 'boolean', description: 'Display members separately in the sidebar' },
            mentionable: { type: 'boolean', description: 'Allow anyone to mention this role' },
          },
          required: ['name'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return { ok: false, message: 'I am missing the Manage Roles permission in this server.' };
      }

      const name = String(args.name).trim();
      const color = args.color || '#99AAB5';
      const hoist = Boolean(args.hoist);
      const mentionable = Boolean(args.mentionable);

      try {
        const role = await interaction.guild.roles.create({
          name,
          color,
          hoist,
          mentionable,
          reason: `Created by ${interaction.user.tag} via Cutie AI`,
        });
        return { ok: true, roleId: role.id, name: role.name, hexColor: role.hexColor, message: `Successfully created new role **${role.name}** (${role.hexColor})!` };
      } catch (err) {
        return { ok: false, message: `Failed to create role: ${err.message}` };
      }
    },
  },

  delete_role: {
    permission: PermissionFlagsBits.ManageRoles,
    definition: {
      type: 'function',
      function: {
        name: 'delete_role',
        description: 'Delete a role from the server (e.g. "hapus role Tester"). Requires ManageRoles permission.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Role name, mention, or ID to delete' },
          },
          required: ['role'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return { ok: false, message: 'I am missing the Manage Roles permission in this server.' };
      }

      const role = resolveRole(interaction, args.role);
      if (!role) {
        return { ok: false, message: `Role "${args.role}" was not found in this server.` };
      }

      if (role.position >= botMember.roles.highest.position) {
        return { ok: false, message: `I cannot delete the "${role.name}" role because it is positioned higher than or equal to my highest role.` };
      }
      if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return { ok: false, message: `You cannot delete the "${role.name}" role because it is positioned higher than or equal to your highest role.` };
      }

      const roleName = role.name;
      try {
        await role.delete(`Deleted by ${interaction.user.tag} via Cutie AI`);
        return { ok: true, message: `Successfully deleted role **${roleName}** from the server.` };
      } catch (err) {
        return { ok: false, message: `Failed to delete role: ${err.message}` };
      }
    },
  },

  get_role_info: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_role_info',
        description: 'Get detailed information about a server role (e.g. "info role Gamer", "roleinfo Admin").',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Role name, mention, or ID' },
          },
          required: ['role'],
        },
      },
    },
    async handler(interaction, args) {
      const role = resolveRole(interaction, args.role);
      if (!role) {
        return { ok: false, message: `Role "${args.role}" was not found.` };
      }

      return {
        ok: true,
        name: role.name,
        id: role.id,
        color: role.hexColor,
        membersCount: role.members.size,
        hoisted: role.hoist,
        mentionable: role.mentionable,
        createdAt: role.createdAt ? role.createdAt.toISOString().split('T')[0] : 'Unknown',
        message: `Role **${role.name}** (ID: ${role.id}): Color ${role.hexColor}, ${role.members.size} members, Hoisted: ${role.hoist ? 'Yes' : 'No'}, Mentionable: ${role.mentionable ? 'Yes' : 'No'}.`,
      };
    },
  },

  list_server_roles: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'list_server_roles',
        description: 'List all roles in this server and their member counts (e.g. "daftar role di server", "list roles").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      if (!interaction.guild) return { ok: false, message: 'This can only be checked in a server.' };
      const rawCache = interaction.guild.roles?.cache;
      const roleList = Array.from(rawCache?.values ? rawCache.values() : (Array.isArray(rawCache) ? rawCache : []));
      const roles = roleList
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => (b.position || 0) - (a.position || 0))
        .map(r => `${r.name} (${r.members?.size || 0} members)`);

      return {
        ok: true,
        count: roles.length,
        roles: roles.slice(0, 30),
        message: `Server has ${roles.length} roles:\n` + roles.slice(0, 20).join('\n') + (roles.length > 20 ? `\n...and ${roles.length - 20} more.` : ''),
      };
    },
  },

  set_welcome_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'set_welcome_channel',
        description: 'Set the automatic welcome message and channel for new members (e.g. "pasang welcome channel di #welcome", "set welcome channel to #welcome with message Welcome {user}!"). Requires ManageGuild permission.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name, ID, or mention' },
            message: { type: 'string', description: 'Optional welcome text ({user} = mention, {server} = server name)' },
          },
          required: ['channel'],
        },
      },
    },
    async handler(interaction, args) {
      const channel = await resolveChannel(interaction, args.channel);
      if (!channel) return { ok: false, message: 'Channel not found.' };

      const msg = args.message || 'Welcome to {server}, {user}!';
      await updateGuildSettings(interaction.guild.id, {
        welcome_channel: channel.id,
        welcome_message: msg,
      });
      return { ok: true, channelId: channel.id, message: `Welcome channel successfully set to <#${channel.id}> with message: "${msg}".` };
    },
  },

  remove_welcome_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'remove_welcome_channel',
        description: 'Disable and remove automatic welcome messages for this server. Requires ManageGuild permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateGuildSettings(interaction.guild.id, { welcome_channel: null });
      return { ok: true, message: 'Automatic welcome messages have been disabled.' };
    },
  },

  set_goodbye_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'set_goodbye_channel',
        description: 'Set the goodbye message and channel when members leave the server (e.g. "pasang goodbye di #goodbye"). Requires ManageGuild permission.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name, ID, or mention' },
            message: { type: 'string', description: 'Optional goodbye message ({username} = name, {server} = server name)' },
          },
          required: ['channel'],
        },
      },
    },
    async handler(interaction, args) {
      const channel = await resolveChannel(interaction, args.channel);
      if (!channel) return { ok: false, message: 'Channel not found.' };

      const msg = args.message || 'Goodbye {username}, take care!';
      await updateGuildSettings(interaction.guild.id, {
        goodbye_channel: channel.id,
        goodbye_message: msg,
      });
      return { ok: true, channelId: channel.id, message: `Goodbye channel successfully set to <#${channel.id}> with message: "${msg}".` };
    },
  },

  remove_goodbye_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'remove_goodbye_channel',
        description: 'Disable and remove goodbye messages for this server. Requires ManageGuild permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateGuildSettings(interaction.guild.id, { goodbye_channel: null });
      return { ok: true, message: 'Goodbye messages have been disabled.' };
    },
  },

  set_autorole: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'set_autorole',
        description: 'Set the automatic role given to new members upon joining (e.g. "set autorole Member", "pasang autorole @Member"). Requires ManageGuild permission.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Role name, mention, or ID' },
          },
          required: ['role'],
        },
      },
    },
    async handler(interaction, args) {
      const role = resolveRole(interaction, args.role);
      if (!role) return { ok: false, message: `Role "${args.role}" was not found.` };

      const botMember = interaction.guild?.members.me;
      if (role.position >= botMember?.roles.highest.position) {
        return { ok: false, message: `I cannot assign "${role.name}" automatically because it is higher than my highest role.` };
      }

      await updateGuildSettings(interaction.guild.id, { autorole: role.id });
      return { ok: true, roleId: role.id, message: `Autorole successfully set to **${role.name}** (<@&${role.id}>).` };
    },
  },

  remove_autorole: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'remove_autorole',
        description: 'Disable automatic role assignment for new members. Requires ManageGuild permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateGuildSettings(interaction.guild.id, { autorole: null });
      return { ok: true, message: 'Autorole has been disabled.' };
    },
  },

  set_log_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'set_log_channel',
        description: 'Set the dedicated moderation audit log channel (e.g. "pasang log channel di #mod-logs"). Requires ManageGuild permission.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name, ID, or mention' },
          },
          required: ['channel'],
        },
      },
    },
    async handler(interaction, args) {
      const channel = await resolveChannel(interaction, args.channel);
      if (!channel) return { ok: false, message: 'Channel not found.' };

      await updateGuildSettings(interaction.guild.id, { log_channel: channel.id });
      return { ok: true, channelId: channel.id, message: `Moderation log channel successfully set to <#${channel.id}>.` };
    },
  },

  remove_log_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'remove_log_channel',
        description: 'Remove the dedicated moderation log channel. Requires ManageGuild permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateGuildSettings(interaction.guild.id, { log_channel: null });
      return { ok: true, message: 'Moderation log channel has been removed.' };
    },
  },

  remove_ai_channel: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'remove_ai_channel',
        description: 'Remove the designated AI channel so Cutie responds via mention or /ask everywhere. Requires ManageGuild permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateGuildSettings(interaction.guild.id, { ask_channel_id: null });
      return { ok: true, message: 'Dedicated AI channel has been removed. Cutie will now respond when mentioned or via /ask.' };
    },
  },

  get_server_config: {
    permission: PermissionFlagsBits.ManageGuild,
    definition: {
      type: 'function',
      function: {
        name: 'get_server_config',
        description: 'View the comprehensive server automation, moderation, and AI configuration dashboard (alias for /serverconfig). Requires ManageGuild permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      if (!interaction.guild) return { ok: false, message: 'Can only be checked inside a server.' };
      const settings = (await getGuildSettings(interaction.guild.id)) || {};
      const autoMute = (await getAutoMuteSettings(interaction.guild.id)) || {};
      const badWords = (await getBadWords(interaction.guild.id)) || [];

      return {
        ok: true,
        welcomeChannel: settings.welcome_channel ? `<#${settings.welcome_channel}>` : 'Disabled',
        goodbyeChannel: settings.goodbye_channel ? `<#${settings.goodbye_channel}>` : 'Disabled',
        autorole: settings.autorole ? `<@&${settings.autorole}>` : 'None',
        logChannel: settings.log_channel ? `<#${settings.log_channel}>` : 'None',
        askChannel: settings.ask_channel_id ? `<#${settings.ask_channel_id}>` : 'Everywhere (via mention)',
        personality: settings.personality || 'sweet',
        antiSpam: autoMute.spam_threshold ? `${autoMute.spam_threshold} msgs/5s (mute ${autoMute.spam_duration})` : 'Disabled',
        badWordsFilter: autoMute.badword_enabled ? `${badWords.length} words (mute ${autoMute.badword_duration})` : 'Disabled',
        antiInvite: 'Enabled',
      };
    },
  },

  configure_auto_mute: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'configure_auto_mute',
        description: 'Configure anti-spam auto-mute settings (e.g. "set auto-mute 5 pesan per 5 detik mute 10m"). Requires ModerateMembers permission.',
        parameters: {
          type: 'object',
          properties: {
            threshold: { type: 'integer', description: 'Number of messages in 5s (3-20)' },
            duration: { type: 'string', description: 'Mute duration like 10m, 1h' },
          },
          required: ['threshold', 'duration'],
        },
      },
    },
    async handler(interaction, args) {
      const threshold = Math.max(3, Math.min(parseInt(args.threshold, 10) || 5, 20));
      const ms = parseDuration(args.duration);
      if (!ms) return { ok: false, message: 'Invalid duration. Use formats like 10m, 1h.' };

      await updateAutoMuteSettings(interaction.guild.id, {
        spam_threshold: threshold,
        spam_duration: args.duration,
      });
      return { ok: true, message: `Anti-spam auto-mute set to ${threshold} messages within 5 seconds ➔ Mute ${args.duration}.` };
    },
  },

  disable_auto_mute: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'disable_auto_mute',
        description: 'Disable spam auto-mute in this server. Requires ModerateMembers permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateAutoMuteSettings(interaction.guild.id, {
        spam_threshold: null,
        spam_duration: null,
      });
      return { ok: true, message: 'Anti-spam auto-mute has been disabled.' };
    },
  },

  add_bad_word: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'add_bad_word',
        description: 'Add a word or phrase to the server blacklist (e.g. "tambahkan badword: [kata]"). Requires ModerateMembers permission.',
        parameters: {
          type: 'object',
          properties: {
            word: { type: 'string', description: 'The word or phrase to blacklist' },
          },
          required: ['word'],
        },
      },
    },
    async handler(interaction, args) {
      const word = String(args.word).toLowerCase().trim();
      if (!word) return { ok: false, message: 'Please provide a valid word.' };

      const success = await addBadWord(interaction.guild.id, word);
      if (success) {
        return { ok: true, message: `Added "${word}" to the blacklisted words list.` };
      }
      return { ok: false, message: `"${word}" is already on the blacklist or could not be added.` };
    },
  },

  remove_bad_word: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'remove_bad_word',
        description: 'Remove a word from the server blacklist (e.g. "hapus badword: [kata]"). Requires ModerateMembers permission.',
        parameters: {
          type: 'object',
          properties: {
            word: { type: 'string', description: 'The word to remove' },
          },
          required: ['word'],
        },
      },
    },
    async handler(interaction, args) {
      const word = String(args.word).toLowerCase().trim();
      const success = await removeBadWord(interaction.guild.id, word);
      if (success) {
        return { ok: true, message: `Removed "${word}" from the blacklisted words list.` };
      }
      return { ok: false, message: `"${word}" was not found in the blacklist.` };
    },
  },

  configure_badword_mute: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'configure_badword_mute',
        description: 'Enable automatic timeout/mute when members use blacklisted words (e.g. "aktifkan badword mute 10m"). Requires ModerateMembers permission.',
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'string', description: 'Mute duration, e.g. "10m", "1h"' },
          },
          required: ['duration'],
        },
      },
    },
    async handler(interaction, args) {
      const ms = parseDuration(args.duration);
      if (!ms) return { ok: false, message: 'Invalid duration. Use formats like 10m, 1h.' };

      await updateAutoMuteSettings(interaction.guild.id, {
        badword_enabled: true,
        badword_duration: args.duration,
      });
      return { ok: true, message: `Bad words auto-mute enabled with a ${args.duration} timeout duration.` };
    },
  },

  disable_badword_mute: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'disable_badword_mute',
        description: 'Disable automatic muting for blacklisted words. Requires ModerateMembers permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await updateAutoMuteSettings(interaction.guild.id, {
        badword_enabled: false,
      });
      return { ok: true, message: 'Automatic muting for blacklisted words has been disabled.' };
    },
  },

  list_bad_words: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'list_bad_words',
        description: 'List all words currently blacklisted on this server. Requires ModerateMembers permission.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      const words = await getBadWords(interaction.guild.id);
      return {
        ok: true,
        count: words.length,
        words,
        message: words.length > 0 ? `Server has ${words.length} blacklisted word(s): ${words.join(', ')}` : 'No blacklisted words found on this server.',
      };
    },
  },

  set_afk: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'set_afk',
        description: 'Set your AFK status with an optional reason (e.g. "aku afk dulu mau makan", "set afk studying").',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Reason for going AFK' },
          },
        },
      },
    },
    async handler(interaction, args) {
      const reason = args.reason || 'AFK';
      state.afkUsers.set(interaction.user.id, { reason, time: Date.now() });
      return { ok: true, reason, message: `You are now set as AFK: "${reason}". I will notify anyone who mentions you!` };
    },
  },

  clear_chat_history: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'clear_chat_history',
        description: 'Reset / clear your conversational memory with Cutie AI so the next message starts with a clean context (e.g. "lupakan chat sebelumnya", "reset memory", "clear history").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      await clearHistory(interaction.user.id);
      return { ok: true, message: 'Your conversation history has been reset. We now have a fresh clean memory context!' };
    },
  },

  get_uptime: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_uptime',
        description: 'Get bot system uptime duration since its last startup (e.g. "cek uptime bot", "berapa lama bot aktif?").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler(interaction) {
      const uptimeMs = interaction.client?.uptime || 0;
      return { ok: true, uptime: formatDuration(uptimeMs, 'en'), message: `Bot has been running online for ${formatDuration(uptimeMs, 'en')}.` };
    },
  },

  shorten_url: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'shorten_url',
        description: 'Shorten a URL into a compact is.gd link (e.g. "pendekin link ini: https://...").',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The long URL to shorten' },
          },
          required: ['url'],
        },
      },
    },
    async handler(interaction, args) {
      let validUrl = String(args.url).trim();
      if (!/^https?:\/\//i.test(validUrl)) {
        validUrl = 'https://' + validUrl;
      }
      try {
        new URL(validUrl);
      } catch (_) {
        return { ok: false, message: 'Invalid URL format.' };
      }

      try {
        const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(validUrl)}`);
        const shortUrl = (await response.text()).trim();
        if (!response.ok || shortUrl.startsWith('Error:')) {
          return { ok: false, message: `Failed to shorten URL: ${shortUrl || 'Service error'}` };
        }
        return { ok: true, original: validUrl, shortened: shortUrl, message: `Shortened link: ${shortUrl}` };
      } catch (err) {
        return { ok: false, message: `Failed to shorten URL: ${err.message}` };
      }
    },
  },

  magic_8ball: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'magic_8ball',
        description: 'Ask the magic 8-ball a yes/no question (e.g. "tanya 8ball: apakah hari ini hujan?").',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Your question for the 8-ball' },
          },
          required: ['question'],
        },
      },
    },
    async handler(interaction, args) {
      const responses = eightBallResponses || [
        'It is certain.', 'Without a doubt.', 'Yes definitely.',
        'Ask again later.', 'Cannot predict now.',
        "Don't count on it.", 'My reply is no.', 'Very doubtful.'
      ];
      const answer = responses[Math.floor(Math.random() * responses.length)];
      return { ok: true, question: args.question, answer, message: `🎱 Question: "${args.question}" — Answer: **${answer}**` };
    },
  },

  trivia_quiz: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'trivia_quiz',
        description: 'Get a fun random trivia quiz question (e.g. "kasih pertanyaan trivia", "main trivia dong").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      try {
        const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        const data = await response.json();
        const item = data.results[0];
        const answers = [...item.incorrect_answers, item.correct_answer].sort(() => Math.random() - 0.5);
        return {
          ok: true,
          category: item.category,
          difficulty: item.difficulty,
          question: item.question,
          choices: answers,
          correctAnswer: item.correct_answer,
          message: `🧠 Category: ${item.category} (${item.difficulty})\nQuestion: ${item.question}\n\nChoices:\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n*(Correct answer: ${item.correct_answer})*`,
        };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch trivia question.' };
      }
    },
  },

  get_random_cat: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_random_cat',
        description: 'Get an adorable random cat photo (e.g. "foto kucing", "gambar cat lucu").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      try {
        const res = await fetch('https://api.thecatapi.com/v1/images/search');
        const data = await res.json();
        return { ok: true, imageUrl: data[0].url, message: `Here is a cute cat for Master! ${data[0].url}` };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch cat image.' };
      }
    },
  },

  get_random_dog: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'get_random_dog',
        description: 'Get a cute random dog photo (e.g. "foto anjing", "gambar puppy").',
        parameters: { type: 'object', properties: {} },
      },
    },
    async handler() {
      try {
        const res = await fetch('https://dog.ceo/api/breeds/image/random');
        const data = await res.json();
        return { ok: true, imageUrl: data.message, message: `Here is a lovely puppy for Master! ${data.message}` };
      } catch (err) {
        return { ok: false, message: 'Failed to fetch dog image.' };
      }
    },
  },
};

function getToolDefinitions(member) {
  return Object.values(tools).map((t) => t.definition);
}

// Every tool call is re-validated here against the *actual* invoking member's
// Discord permissions, regardless of what the AI model decided to do. This is
// the same permission model used by the /ban, /kick, /warn, /timeout slash
// commands — the AI can never bypass it just by being asked nicely.
async function runTool(interaction, name, args) {
  const tool = tools[name];
  if (!tool) return { ok: false, message: `Unknown tool: ${name}` };

  if (tool.permission) {
    if (!interaction.guild) {
      return { ok: false, message: 'This action can only be executed in a server, not in Direct Messages (DM).' };
    }
    if (!hasPermission(interaction, tool.permission)) {
      const permName = PERMISSION_NAMES[tool.permission] || 'Moderator';
      return {
        ok: false,
        message: `Access denied: You do not have the '${permName}' permission in this server to perform this action.`,
      };
    }
  }

  try {
    return await tool.handler(interaction, args || {});
  } catch (err) {
    console.error(`Error running AI tool "${name}":`, err);
    return { ok: false, message: 'An error occurred while executing this action: ' + (err.message || 'Unknown error') };
  }
}

module.exports = { getToolDefinitions, runTool };
