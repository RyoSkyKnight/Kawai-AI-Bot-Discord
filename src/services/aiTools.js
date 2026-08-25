const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarning, getWarnings, clearWarnings, logModAction, getModStats } = require('./moderation');
const { sendLog } = require('./logChannel');
const { parseDuration } = require('../utils/duration');
const state = require('../state');

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

  set_reminder: {
    permission: null,
    definition: {
      type: 'function',
      function: {
        name: 'set_reminder',
        description: "Set a reminder for the invoking user.",
        parameters: {
          type: 'object',
          properties: {
            time: { type: 'string', description: 'Time duration, e.g. 10s, 5m, 2h, 1d' },
            message: { type: 'string', description: 'What to remind the user about' },
          },
          required: ['time', 'message'],
        },
      },
    },
    async handler(interaction, args) {
      const { parseDuration } = require('../utils/duration');
      const duration = parseDuration(args.time);
      if (!duration) return { ok: false, message: 'Invalid time format. Use s, m, h, or d (e.g. 10m, 2h).' };

      const user = interaction.user;

      setTimeout(() => {
        user.send(`⏰ **Reminder:** ${args.message}`)
          .catch(() => interaction.followUp({ content: `<@${user.id}> ⏰ **Reminder:** ${args.message}` }).catch(() => {}));
      }, duration);

      return { ok: true, message: `Successfully scheduled a reminder in ${args.time} for "${args.message}".` };
    },
  },
};

function getToolDefinitions(member) {
  if (!member) return [];
  return Object.values(tools)
    .filter((t) => !t.permission || member.permissions.has(t.permission))
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

  if (tool.permission && !interaction.member.permissions.has(tool.permission)) {
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
