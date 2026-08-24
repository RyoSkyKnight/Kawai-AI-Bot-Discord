const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarning, getWarnings, clearWarnings, logModAction, getModStats } = require('./moderation');
const { sendLog } = require('./logChannel');
const { parseDuration } = require('../utils/duration');

// Pull a Discord snowflake out of a raw string or a <@id> / <@!id> mention.
function extractUserId(raw) {
  if (!raw) return null;
  const match = String(raw).match(/\d{17,20}/);
  return match ? match[0] : null;
}

async function resolveTarget(interaction, userIdRaw) {
  const userId = extractUserId(userIdRaw);
  if (!userId) return { error: 'No valid user ID or mention was provided. Ask the user to @mention who they mean.' };

  const user = await interaction.client.users.fetch(userId).catch(() => null);
  if (!user) return { error: `Could not find a Discord user with ID ${userId}.` };

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  return { user, member };
}

// Same hierarchy rules used by /ban, /kick, /timeout.
function checkHierarchy(interaction, member, botMember) {
  if (!member) return null;
  if (member.roles.highest.position >= botMember.roles.highest.position) {
    return "I can't do that to this user — their highest role is equal to or above mine.";
  }
  if (member.roles.highest.position >= interaction.member.roles.highest.position) {
    return "You can't do that to this user — their highest role is equal to or above yours.";
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
        .setColor('#FFFF00')
        .setTitle('⚠️ User Warned (via /ask)')
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
        .setColor('#00FF00')
        .setTitle('✅ Warnings Cleared (via /ask)')
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
        description: 'Timeout (temporarily mute) a user. Maximum duration is 28 days.',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Discord user ID or mention' },
            duration: { type: 'string', description: 'Duration like 10m, 1h, 1d' },
            reason: { type: 'string', description: 'Reason for the timeout' },
          },
          required: ['userId', 'duration'],
        },
      },
    },
    async handler(interaction, args) {
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { ok: false, message: "I'm missing the Moderate Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const ms = parseDuration(args.duration);
      if (!ms || ms > 2419200000) {
        return { ok: false, message: 'Invalid duration. Use formats like 10m, 1h, 1d — maximum is 28 days.' };
      }

      const hierarchyError = checkHierarchy(interaction, member, botMember);
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const reason = args.reason || 'No reason provided';
      await member.timeout(ms, reason);
      await logModAction(interaction.guild.id, 'timeout', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏰ User Timed Out (via /ask)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Duration', value: args.duration, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Timed out ${user.tag} for ${args.duration}.` };
    },
  },

  kick_user: {
    permission: PermissionFlagsBits.KickMembers,
    definition: {
      type: 'function',
      function: {
        name: 'kick_user',
        description: 'Kick a user from the server.',
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
        return { ok: false, message: "I'm missing the Kick Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };
      if (!member) return { ok: false, message: `${user.tag} is not currently a member of this server.` };

      const hierarchyError = checkHierarchy(interaction, member, botMember);
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const reason = args.reason || 'No reason provided';
      await member.kick(reason);
      await logModAction(interaction.guild.id, 'kick', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('👢 User Kicked (via /ask)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Kicked ${user.tag} from the server.` };
    },
  },

  ban_user: {
    permission: PermissionFlagsBits.BanMembers,
    definition: {
      type: 'function',
      function: {
        name: 'ban_user',
        description: 'Ban a user from the server.',
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
        return { ok: false, message: "I'm missing the Ban Members permission in this server." };
      }

      const { user, member, error } = await resolveTarget(interaction, args.userId);
      if (error) return { ok: false, message: error };

      const hierarchyError = checkHierarchy(interaction, member, botMember);
      if (hierarchyError) return { ok: false, message: hierarchyError };

      const reason = args.reason || 'No reason provided';
      const deleteDays = Math.min(Math.max(parseInt(args.deleteMessageDays, 10) || 0, 0), 7);

      await interaction.guild.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
      await logModAction(interaction.guild.id, 'ban', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 User Banned (via /ask)')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});

      return { ok: true, message: `Banned ${user.tag} from the server.` };
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
};

function getToolDefinitions(member) {
  if (!member) return [];
  return Object.values(tools)
    .filter((t) => member.permissions.has(t.permission))
    .map((t) => t.definition);
}

// Every tool call is re-validated here against the *actual* invoking member's
// Discord permissions, regardless of what the AI model decided to do. This is
// the same permission model used by the /ban, /kick, /warn, /timeout slash
// commands — the AI can never bypass it just by being asked nicely.
async function runTool(interaction, name, args) {
  const tool = tools[name];
  if (!tool) return { ok: false, message: `Unknown tool: ${name}` };

  if (!interaction.guild) {
    return { ok: false, message: 'This action can only be used inside a server, not in DMs.' };
  }

  if (!interaction.member.permissions.has(tool.permission)) {
    return { ok: false, message: "You don't have permission to do that in this server." };
  }

  try {
    return await tool.handler(interaction, args || {});
  } catch (err) {
    console.error(`Error running AI tool "${name}":`, err);
    return { ok: false, message: 'Something went wrong while performing that action.' };
  }
}

module.exports = { getToolDefinitions, runTool };
