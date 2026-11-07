const { PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { addWarning, getWarnings, clearWarnings, logModAction, getModStats } = require('./moderation');
const { sendLog } = require('./logChannel');
const { parseDuration, formatDuration } = require('../utils/duration');
const { updateGuildSettings } = require('./guildSettings');
const math = require('mathjs');
const state = require('../state');

const PERMISSION_NAMES = {
  [PermissionFlagsBits.KickMembers]: 'Kick Members',
  [PermissionFlagsBits.BanMembers]: 'Ban Members',
  [PermissionFlagsBits.ModerateMembers]: 'Moderate Members (Mute/Timeout/Warn)',
  [PermissionFlagsBits.ManageMessages]: 'Manage Messages',
  [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
  [PermissionFlagsBits.ManageNicknames]: 'Manage Nicknames',
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
  if (!userIdRaw) return { error: 'Target pengguna belum ditentukan. Silakan sebutkan @mention atau ID pengguna.' };
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

  return { error: 'Pengguna tidak ditemukan. Silakan gunakan @mention atau user ID yang valid.' };
}

// Role hierarchy & self/owner protection rules.
function checkHierarchy(interaction, member, botMember, action = null) {
  if (!member) return null;
  const guild = interaction.guild;
  if (!guild) return null;

  // 1. Cannot moderate the server owner
  if (member.id === guild.ownerId) {
    return "Tidak dapat melakukan tindakan moderasi terhadap Owner server.";
  }

  // 2. Cannot moderate the bot itself
  if (member.id === botMember?.id || member.id === interaction.client?.user?.id) {
    return "Aku tidak bisa melakukan tindakan moderasi terhadap diriku sendiri!";
  }

  // 3. User cannot moderate themselves
  if (member.id === interaction.user.id) {
    return "Master tidak bisa melakukan tindakan moderasi terhadap diri sendiri!";
  }

  // 4. Bot permission & role hierarchy check
  if (action === 'kick' && !member.kickable) {
    return "Aku tidak bisa me-kick user ini karena role mereka sejajar atau lebih tinggi dari role tertinggiku.";
  }
  if (action === 'ban' && !member.bannable) {
    return "Aku tidak bisa mem-ban user ini karena role mereka sejajar atau lebih tinggi dari role tertinggiku.";
  }
  if ((action === 'timeout' || action === 'mute') && !member.moderatable) {
    return "Aku tidak bisa me-mute/timeout user ini karena role mereka sejajar atau lebih tinggi dari role tertinggiku.";
  }
  if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
    return "Aku tidak bisa melakukan itu — role tertinggi mereka sejajar atau di atas role tertinggiku.";
  }

  // 5. Invoking user role hierarchy check (guild owner is exempt)
  if (interaction.user.id !== guild.ownerId && interaction.member) {
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return "Master tidak bisa melakukan tindakan ini — role tertinggi target sejajar atau lebih tinggi dari role Master.";
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

      await sendLog(interaction.guild, embed);
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
        description: 'Timeout (temporarily mute) a user in the server (e.g. "timeout @user 10m", "mute @user 1 jam"). Maximum duration is 28 days.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            duration: { type: 'string', description: 'Duration like 10m, 10 menit, 1h, 1d (defaults to 10m if omitted)' },
            reason: { type: 'string', description: 'Reason for the timeout/mute' },
          },
          required: ['userId'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { ok: false, message: "Bot tidak memiliki izin Moderate Members di server ini." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} bukan anggota server ini saat ini.` };

      const hierarchyError = checkHierarchy(interaction, member, botMember, 'timeout');
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const rawDuration = args.duration || args.time || '10m';
      const ms = parseDuration(rawDuration);
      if (!ms || ms > 2419200000) {
        return { ok: false, message: 'Durasi timeout tidak valid. Gunakan format seperti 10 menit, 1h, 1d (maksimal 28 hari).' };
      }

      const reason = args.reason || 'Timed out via Cutie AI';
      await member.timeout(ms, reason);
      await logModAction(interaction.guild.id, 'timeout', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('User Timed Out (via Cutie AI)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Duration', value: formatDuration(ms, 'id'), inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Berhasil me-mute/timeout ${user.tag} selama ${formatDuration(ms, 'id')}.` };
    },
  },

  mute_user: {
    permission: PermissionFlagsBits.ModerateMembers,
    definition: {
      type: 'function',
      function: {
        name: 'mute_user',
        description: 'Mute / timeout a user in the server (e.g. "tolong mute @user 10 menit", "mute @user 1h"). Alias for timeout_user.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            duration: { type: 'string', description: 'Duration like 10m, 10 menit, 1h, 1d (defaults to 10m if omitted)' },
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
        description: 'Remove timeout / unmute a user in the server (e.g. "tolong unmute @user", "lepas timeout @user").',
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
        return { ok: false, message: "Bot tidak memiliki izin Moderate Members di server ini." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} bukan anggota server ini saat ini.` };

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

      return { ok: true, message: `Berhasil melepas timeout/mute untuk ${user.tag}.` };
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
        description: 'Kick a user from the server (e.g. "tolong kick @user [alasan]").',
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
        return { ok: false, message: "Bot tidak memiliki izin Kick Members di server ini." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} bukan anggota server ini saat ini.` };

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

      return { ok: true, message: `Berhasil mengeluarkan ${user.tag} dari server.` };
    },
  },

  ban_user: {
    permission: PermissionFlagsBits.BanMembers,
    definition: {
      type: 'function',
      function: {
        name: 'ban_user',
        description: 'Ban a user from the server (e.g. "tolong ban @user [alasan]").',
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
        return { ok: false, message: "Bot tidak memiliki izin Ban Members di server ini." };
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

      return { ok: true, message: `Berhasil mem-ban ${user.tag} dari server.` };
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
        return { ok: false, message: "Bot tidak memiliki izin Ban Members di server ini." };
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
        return { ok: false, message: 'Tidak dapat menemukan ID user yang di-ban. Mohon berikan user ID yang valid.' };
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

        return { ok: true, message: `Berhasil meng-unban ${targetTag} (${targetId}) dari server.` };
      } catch (err) {
        return { ok: false, message: `Gagal meng-unban user: ${err.message || 'ID tidak ditemukan dalam daftar ban.'}` };
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
        return { ok: true, message: `Hasil dari ${args.expression} = ${result}` };
      } catch (err) {
        return { ok: false, message: `Gagal menghitung ekspresi: ${err.message}` };
      }
    },
  },

  set_reminder: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'set_reminder',
        description: "Set a countdown timer or reminder for the user. Call this tool whenever the user asks to be reminded of something, set a timer, or count down time (e.g. 'tolong ingatkan aku dalam 1 menit ya', 'set timer 15 detik', 'ingetin 10 menit lagi', 'remind me in 1 hour').",
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'string', description: 'Duration or time, e.g. "15s", "15 detik", "1m", "5 menit", "1h", "2 jam"' },
            seconds: { type: 'integer', description: 'Number of seconds directly (e.g. 15)' },
            minutes: { type: 'number', description: 'Number of minutes directly (e.g. 1)' },
            time: { type: 'string', description: 'Alias for duration' },
            message: { type: 'string', description: 'What to remind the user about (e.g. "minum coklat", "minum obat"). Defaults to "Waktunya selesai!" if not provided.' },
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
        return { ok: false, message: 'Format waktu tidak valid. Gunakan format seperti 15 detik, 10s, 1m, 5 menit, 1 jam.' };
      }
      if (ms > 24 * 60 * 60 * 1000 * 30) {
        return { ok: false, message: 'Durasi maksimal pengingat adalah 30 hari.' };
      }

      const user = interaction.user;
      const client = interaction.client;
      const channelId = interaction.channelId || interaction.channel?.id;
      let initialChannel = interaction.channel;
      const reminderMsg = args.message && args.message.trim() ? args.message.trim() : 'Waktunya selesai!';
      const timeStr = formatDuration(ms, 'id');

      console.log(`[Timer] Scheduling reminder for user ${user?.id} in ${ms}ms (${timeStr}): "${reminderMsg}" in channel ${channelId}`);

      setTimeout(async () => {
        console.log(`[Timer] Firing reminder for user ${user?.id}: "${reminderMsg}"`);
        const alertContent = `⏰ <@${user.id}> **Ting-ting! Pengingat dari Cutie untuk Master (${timeStr})** 💕\n> "${reminderMsg}"\n*(◕‿◕)♡ Jangan lupa ya, Master!*`;
        let sent = false;

        // 1. Try sending to the channel where it was requested
        let targetChannel = initialChannel;
        if ((!targetChannel || typeof targetChannel.send !== 'function') && client && channelId) {
          targetChannel = await client.channels.fetch(channelId).catch(() => null);
        }

        if (targetChannel && typeof targetChannel.send === 'function') {
          try {
            await targetChannel.send({ content: alertContent });
            sent = true;
            console.log(`[Timer] Successfully sent reminder to channel ${channelId}`);
          } catch (err) {
            console.error('[Timer] Failed to send to channel:', err.message || err);
          }
        }

        // 2. Fallback to DM if channel failed
        if (!sent && user && typeof user.send === 'function') {
          try {
            await user.send({ content: alertContent });
            sent = true;
            console.log(`[Timer] Successfully sent reminder to user DM`);
          } catch (err) {
            console.error('[Timer] Failed to send to DM:', err.message || err);
          }
        }

        if (!sent) {
          console.error(`[Timer] CRITICAL: Could not deliver reminder to channel ${channelId} or user DM!`);
        }
      }, ms);

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
        description: "Set a countdown timer or reminder. Call this tool whenever the user asks to set a timer, countdown, or be reminded (e.g. 'set timer 1 menit', 'tolong pasang timer 15 detik', 'set timer 10s').",
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'string', description: 'Duration or time, e.g. "15s", "15 detik", "1m", "5 menit", "1h", "2 jam"' },
            seconds: { type: 'integer', description: 'Number of seconds directly (e.g. 15)' },
            minutes: { type: 'number', description: 'Number of minutes directly (e.g. 1)' },
            time: { type: 'string', description: 'Alias for duration' },
            message: { type: 'string', description: 'Note for the timer. Defaults to "Waktunya selesai!" if not provided.' },
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
        return { ok: false, message: 'Berikan minimal 2 opsi untuk dipilih!' };
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
        return { ok: false, message: 'Tidak dapat membuat polling di channel ini.' };
      }
      let opts = args.options;
      if (typeof opts === 'string') {
        opts = opts.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(opts) || opts.length < 2) {
        return { ok: false, message: 'Polling membutuhkan minimal 2 opsi.' };
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
        return { ok: true, message: `Polling "${args.question}" dengan ${opts.length} opsi berhasil dibuat di channel!` };
      } catch (err) {
        return { ok: false, message: `Gagal mengirim polling: ${err.message}` };
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
      if (!userId) return { ok: false, message: 'User tidak teridentifikasi.' };

      if (!state.userTodos.has(userId)) {
        state.userTodos.set(userId, []);
      }
      const todos = state.userTodos.get(userId);

      const action = (args.action || 'list').toLowerCase();

      if (action === 'add') {
        if (!args.item || !args.item.trim()) {
          return { ok: false, message: 'Sebutkan tugas/catatan yang ingin ditambahkan!' };
        }
        todos.push(args.item.trim());
        return {
          ok: true,
          message: `Berhasil menambahkan ke to-do list: "${args.item.trim()}". Sekarang kamu punya ${todos.length} tugas.`,
          todos,
        };
      }

      if (action === 'list') {
        if (todos.length === 0) {
          return { ok: true, message: 'To-do list kamu saat ini masih kosong.', todos: [] };
        }
        const formatted = todos.map((t, idx) => `${idx + 1}. ${t}`).join('\n');
        return {
          ok: true,
          message: `Daftar to-do kamu (${todos.length}):\n${formatted}`,
          todos,
        };
      }

      if (action === 'remove') {
        if (todos.length === 0) {
          return { ok: false, message: 'To-do list kamu sudah kosong.' };
        }
        const idx = parseInt(args.item, 10);
        let removed;
        if (!isNaN(idx) && idx >= 1 && idx <= todos.length) {
          removed = todos.splice(idx - 1, 1)[0];
        } else if (args.item) {
          const matchIdx = todos.findIndex(t => t.toLowerCase().includes(args.item.toLowerCase()));
          if (matchIdx !== -1) {
            removed = todos.splice(matchIdx, 1)[0];
          }
        }
        if (!removed) {
          return { ok: false, message: `Tidak menemukan tugas yang cocok dengan "${args.item}".` };
        }
        return { ok: true, message: `Berhasil menghapus tugas: "${removed}". Sisa ${todos.length} tugas.` };
      }

      if (action === 'clear') {
        state.userTodos.set(userId, []);
        return { ok: true, message: 'Semua to-do list kamu telah dibersihkan.' };
      }

      return { ok: false, message: `Aksi tidak dikenal: ${action}` };
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
        return { ok: false, message: 'Pesan tidak dapat dihapus di channel ini.' };
      }
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return { ok: false, message: 'Aku tidak memiliki izin ManageMessages di server ini.' };
      }

      const amount = Math.max(1, Math.min(parseInt(args.amount, 10) || 1, 100));
      try {
        const deleted = await channel.bulkDelete(amount, true);
        return { ok: true, message: `Berhasil menghapus ${deleted.size} pesan terakhir.` };
      } catch (err) {
        return { ok: false, message: `Gagal menghapus pesan: ${err.message}` };
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
        return { ok: false, message: 'Slowmode tidak dapat diatur di channel ini.' };
      }
      const botMember = interaction.guild?.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return { ok: false, message: 'Aku tidak memiliki izin ManageChannels di server ini.' };
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
        return { ok: false, message: 'Durasi slowmode harus antara 0 dan 21600 detik (maksimal 6 jam).' };
      }

      try {
        await channel.setRateLimitPerUser(seconds);
        return {
          ok: true,
          message: seconds === 0
            ? 'Slowmode berhasil dimatikan.'
            : `Slowmode channel berhasil diatur ke ${seconds} detik per user.`,
        };
      } catch (err) {
        return { ok: false, message: `Gagal mengatur slowmode: ${err.message}` };
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
        if (!res.ok) return { ok: false, message: 'Layanan Urban Dictionary sedang tidak dapat diakses.' };
        const data = await res.json();
        if (!data.list || data.list.length === 0) {
          return { ok: false, message: `Tidak ditemukan definisi untuk istilah "${args.term}".` };
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
        return { ok: false, message: `Gagal mengambil data: ${err.message}` };
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
        return { ok: false, message: 'Masukkan teks atau URL untuk dibuatkan QR code.' };
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(args.text.trim())}`;
      return {
        ok: true,
        qrUrl,
        message: `QR code berhasil dibuat untuk: ${args.text.trim()}`,
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
        return { ok: false, message: 'Perintah ini hanya dapat digunakan di dalam server.' };
      }
      const action = (args.action || 'set').toLowerCase();
      if (action === 'remove' || action === 'disable') {
        const success = await updateGuildSettings(interaction.guild.id, { ask_channel_id: null });
        return {
          ok: success,
          message: success
            ? 'Channel khusus AI berhasil dimatikan. Bot sekarang hanya akan merespon jika dimention.'
            : 'Gagal memperbarui pengaturan database.',
        };
      }

      let targetChannelId = interaction.channel?.id;
      if (args.channelId) {
        const match = String(args.channelId).match(/\d{17,20}/);
        if (match) targetChannelId = match[0];
      }

      if (!targetChannelId) {
        return { ok: false, message: 'Tidak dapat mendeteksi ID channel target.' };
      }

      const success = await updateGuildSettings(interaction.guild.id, { ask_channel_id: targetChannelId });
      return {
        ok: success,
        message: success
          ? `Channel auto-reply AI berhasil diatur ke <#${targetChannelId}>!`
          : 'Gagal menyimpan pengaturan ke database.',
      };
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
      return { ok: false, message: 'Aksi ini hanya dapat dijalankan di dalam server, bukan di Direct Messages (DM).' };
    }
    if (!hasPermission(interaction, tool.permission)) {
      const permName = PERMISSION_NAMES[tool.permission] || 'Moderator';
      return {
        ok: false,
        message: `Akses ditolak: Master tidak memiliki izin '${permName}' di server ini untuk menjalankan aksi tersebut.`,
      };
    }
  }

  try {
    return await tool.handler(interaction, args || {});
  } catch (err) {
    console.error(`Error running AI tool "${name}":`, err);
    return { ok: false, message: 'Terjadi kesalahan saat menjalankan aksi tersebut: ' + (err.message || 'Error tidak diketahui') };
  }
}

module.exports = { getToolDefinitions, runTool };
