require('dotenv').config();

const { REST, Routes, PermissionFlagsBits } = require('discord.js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
  {
    name: 'ask',
    description: 'Ask a question to the bot powered by Google Generative AI',
    options: [
      {
        name: 'question',
        type: 3,
        description: 'The question you want to ask the bot',
        required: true,
      }
    ]
  },
  {
    name: 'profile',
    description: 'Check a user\'s Discord profile information',
    options: [
      {
        name: 'user',
        description: 'The user you want to check',
        type: 6,
        required: false
      }
    ]
  },
  {
    name: 'help',
    description: 'Display all available commands and their descriptions'
  },
  {
    name: 'ping',
    description: 'Check bot\'s response time and latency'
  },
  {
    name: 'serverinfo',
    description: 'Display information about the current server'
  },
  {
    name: 'avatar',
    description: 'Get user\'s avatar in high quality',
    options: [
      {
        name: 'user',
        description: 'The user whose avatar you want to see',
        type: 6,
        required: false
      }
    ]
  },
  {
    name: 'roll',
    description: 'Roll a dice',
    options: [
      {
        name: 'sides',
        type: 4,
        description: 'Number of sides on the dice (default: 6)',
        required: false
      }
    ]
  },
  {
    name: 'coinflip',
    description: 'Flip a coin and get heads or tails'
  },
  {
    name: '8ball',
    description: 'Ask the magic 8ball a yes/no question',
    options: [
      {
        name: 'question',
        type: 3,
        description: 'Your yes/no question',
        required: true
      }
    ]
  },
  {
    name: 'translate',
    description: 'Translate text using AI',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text to translate',
        required: true
      },
      {
        name: 'language',
        type: 3,
        description: 'Target language (e.g., English, Indonesian, Japanese)',
        required: true
      }
    ]
  },
  {
    name: 'quote',
    description: 'Get a random inspirational quote'
  },
  {
    name: 'meme',
    description: 'Generate a random meme'
  },
  {
    name: 'poll',
    description: 'Create a poll with up to 10 options',
    options: [
      {
        name: 'question',
        type: 3,
        description: 'The poll question',
        required: true
      },
      {
        name: 'option1',
        type: 3,
        description: 'First option',
        required: true
      },
      {
        name: 'option2',
        type: 3,
        description: 'Second option',
        required: true
      },
      {
        name: 'option3',
        type: 3,
        description: 'Third option',
        required: false
      },
      {
        name: 'option4',
        type: 3,
        description: 'Fourth option',
        required: false
      },
      {
        name: 'option5',
        type: 3,
        description: 'Fifth option',
        required: false
      }
    ]
  },
  {
    name: 'remind',
    description: 'Set a reminder',
    options: [
      {
        name: 'time',
        type: 3,
        description: 'Time (e.g., 10m, 1h, 2d)',
        required: true
      },
      {
        name: 'message',
        type: 3,
        description: 'Reminder message',
        required: true
      }
    ]
  },
  {
    name: 'weather',
    description: 'Get weather information for a city',
    options: [
      {
        name: 'city',
        type: 3,
        description: 'City name',
        required: true
      }
    ]
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    options: [
      {
        name: 'expression',
        type: 3,
        description: 'Math expression (e.g., 2+2, 10*5, sqrt(16))',
        required: true
      }
    ]
  },
  {
    name: 'joke',
    description: 'Get a random joke'
  },
  {
    name: 'fact',
    description: 'Get a random interesting fact'
  },
  {
    name: 'trivia',
    description: 'Get a random trivia question'
  },
  {
    name: 'urban',
    description: 'Look up a word in Urban Dictionary',
    options: [
      {
        name: 'word',
        type: 3,
        description: 'Word to look up',
        required: true
      }
    ]
  },
  {
    name: 'wiki',
    description: 'Search Wikipedia',
    options: [
      {
        name: 'query',
        type: 3,
        description: 'Search query',
        required: true
      }
    ]
  },
  {
    name: 'userinfo',
    description: 'Get detailed information about a user',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to get info about',
        required: false
      }
    ]
  },
  {
    name: 'roleinfo',
    description: 'Get information about a role',
    options: [
      {
        name: 'role',
        type: 8,
        description: 'The role to get info about',
        required: true
      }
    ]
  },
  {
    name: 'choose',
    description: 'Let the bot choose between multiple options',
    options: [
      {
        name: 'options',
        type: 3,
        description: 'Options separated by commas (e.g., pizza, burger, pasta)',
        required: true
      }
    ]
  },
  {
    name: 'reverse',
    description: 'Reverse text',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text to reverse',
        required: true
      }
    ]
  },
  {
    name: 'ascii',
    description: 'Convert text to ASCII art',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text to convert',
        required: true
      }
    ]
  },
  {
    name: 'embed',
    description: 'Create a custom embed message',
    options: [
      {
        name: 'title',
        type: 3,
        description: 'Embed title',
        required: true
      },
      {
        name: 'description',
        type: 3,
        description: 'Embed description',
        required: true
      },
      {
        name: 'color',
        type: 3,
        description: 'Hex color (e.g., #FF0000)',
        required: false
      }
    ]
  },
  {
    name: 'afk',
    description: 'Set your AFK status',
    options: [
      {
        name: 'reason',
        type: 3,
        description: 'Reason for being AFK',
        required: false
      }
    ]
  },
  {
    name: 'movie',
    description: 'Get information about a movie',
    options: [
      {
        name: 'title',
        type: 3,
        description: 'Movie title',
        required: true
      }
    ]
  },
  {
    name: 'anime',
    description: 'Search for anime information',
    options: [
      {
        name: 'title',
        type: 3,
        description: 'Anime title',
        required: true
      }
    ]
  },
  {
    name: 'define',
    description: 'Get dictionary definition of a word',
    options: [
      {
        name: 'word',
        type: 3,
        description: 'Word to define',
        required: true
      }
    ]
  },
  {
    name: 'gif',
    description: 'Search for a GIF',
    options: [
      {
        name: 'query',
        type: 3,
        description: 'Search query',
        required: true
      }
    ]
  },
  {
    name: 'dog',
    description: 'Get a random dog image'
  },
  {
    name: 'cat',
    description: 'Get a random cat image'
  },
  {
    name: 'crypto',
    description: 'Get cryptocurrency price',
    options: [
      {
        name: 'coin',
        type: 3,
        description: 'Cryptocurrency symbol (e.g., BTC, ETH)',
        required: true
      }
    ]
  },
  {
    name: 'qr',
    description: 'Generate a QR code',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text or URL to encode',
        required: true
      }
    ]
  },
  {
    name: 'shorten',
    description: 'Shorten a URL',
    options: [
      {
        name: 'url',
        type: 3,
        description: 'URL to shorten',
        required: true
      }
    ]
  },
  {
    name: 'botinfo',
    description: 'Get information about the bot'
  },
  {
    name: 'uptime',
    description: 'Check how long the bot has been running'
  },

  // ============================================
  // MODERATION COMMANDS
  // ============================================
  {
    name: 'ban',
    description: 'Ban a user from the server',
    default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to ban',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for the ban',
        required: false
      },
      {
        name: 'delete_messages',
        type: 4,
        description: 'Delete messages from the last X days (0-7)',
        required: false
      }
    ]
  },
  {
    name: 'unban',
    description: 'Unban a user from the server',
    default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
    options: [
      {
        name: 'user_id',
        type: 3,
        description: 'The user ID to unban',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for the unban',
        required: false
      }
    ]
  },
  {
    name: 'kick',
    description: 'Kick a user from the server',
    default_member_permissions: PermissionFlagsBits.KickMembers.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to kick',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for the kick',
        required: false
      }
    ]
  },
  {
    name: 'timeout',
    description: 'Timeout a user (mute temporarily)',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to timeout',
        required: true
      },
      {
        name: 'duration',
        type: 3,
        description: 'Duration (e.g., 10m, 1h, 1d)',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for the timeout',
        required: false
      }
    ]
  },
  {
    name: 'untimeout',
    description: 'Remove timeout from a user',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to remove timeout from',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for removing timeout',
        required: false
      }
    ]
  },
  {
    name: 'warn',
    description: 'Warn a user',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to warn',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for the warning',
        required: true
      }
    ]
  },
  {
    name: 'warnings',
    description: 'View warnings for a user',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to check warnings for',
        required: true
      }
    ]
  },
  {
    name: 'clearwarnings',
    description: 'Clear all warnings for a user',
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to clear warnings for',
        required: true
      }
    ]
  },
  {
    name: 'clear',
    description: 'Clear messages in a channel',
    default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [
      {
        name: 'amount',
        type: 4,
        description: 'Number of messages to delete (1-100)',
        required: true
      },
      {
        name: 'user',
        type: 6,
        description: 'Only delete messages from this user',
        required: false
      }
    ]
  },
  {
    name: 'slowmode',
    description: 'Set slowmode for the channel',
    default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [
      {
        name: 'duration',
        type: 4,
        description: 'Slowmode duration in seconds (0 to disable)',
        required: true
      }
    ]
  },
  {
    name: 'lock',
    description: 'Lock a channel',
    default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [
      {
        name: 'reason',
        type: 3,
        description: 'Reason for locking',
        required: false
      }
    ]
  },
  {
    name: 'unlock',
    description: 'Unlock a channel',
    default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
    options: [
      {
        name: 'reason',
        type: 3,
        description: 'Reason for unlocking',
        required: false
      }
    ]
  },

  // ============================================
  // ROLE MANAGEMENT COMMANDS
  // ============================================
  {
    name: 'addrole',
    description: 'Add a role to a user',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to add role to',
        required: true
      },
      {
        name: 'role',
        type: 8,
        description: 'The role to add',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for adding the role',
        required: false
      }
    ]
  },
  {
    name: 'removerole',
    description: 'Remove a role from a user',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to remove role from',
        required: true
      },
      {
        name: 'role',
        type: 8,
        description: 'The role to remove',
        required: true
      },
      {
        name: 'reason',
        type: 3,
        description: 'Reason for removing the role',
        required: false
      }
    ]
  },
  {
    name: 'createrole',
    description: 'Create a new role',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      {
        name: 'name',
        type: 3,
        description: 'Role name',
        required: true
      },
      {
        name: 'color',
        type: 3,
        description: 'Role color (hex, e.g., #FF0000)',
        required: false
      },
      {
        name: 'hoist',
        type: 5,
        description: 'Display role separately',
        required: false
      },
      {
        name: 'mentionable',
        type: 5,
        description: 'Allow anyone to mention this role',
        required: false
      }
    ]
  },
  {
    name: 'deleterole',
    description: 'Delete a role',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      {
        name: 'role',
        type: 8,
        description: 'The role to delete',
        required: true
      }
    ]
  },
  {
    name: 'roles',
    description: 'List all roles in the server or roles of a user',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to check roles for',
        required: false
      }
    ]
  },

  // ============================================
  // WELCOME SYSTEM COMMANDS
  // ============================================
  {
    name: 'setwelcome',
    description: 'Set welcome message configuration',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: 'channel',
        type: 7,
        description: 'Channel to send welcome messages',
        required: true
      },
      {
        name: 'message',
        type: 3,
        description: 'Welcome message ({user} = mention, {username} = name, {server} = server name)',
        required: false
      }
    ]
  },
  {
    name: 'removewelcome',
    description: 'Disable welcome messages',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  {
    name: 'testwelcome',
    description: 'Test the welcome message',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  {
    name: 'setgoodbye',
    description: 'Set goodbye message configuration',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: 'channel',
        type: 7,
        description: 'Channel to send goodbye messages',
        required: true
      },
      {
        name: 'message',
        type: 3,
        description: 'Goodbye message ({username} = name, {server} = server name)',
        required: false
      }
    ]
  },
  {
    name: 'removegoodbye',
    description: 'Disable goodbye messages',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },
  {
    name: 'autorole',
    description: 'Set auto role for new members',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    options: [
      {
        name: 'role',
        type: 8,
        description: 'Role to give to new members',
        required: true
      }
    ]
  },
  {
    name: 'removeautorole',
    description: 'Remove auto role for new members',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
  },

  // ============================================
  // LOGGING COMMANDS
  // ============================================
  {
    name: 'setlog',
    description: 'Set logging channel for server events',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: 'channel',
        type: 7,
        description: 'Channel for logging',
        required: true
      }
    ]
  },
  {
    name: 'removelog',
    description: 'Disable server logging',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  },

  // ============================================
  // ADDITIONAL MODERATION COMMANDS
  // ============================================
  {
    name: 'nickname',
    description: 'Change a user\'s nickname',
    default_member_permissions: PermissionFlagsBits.ManageNicknames.toString(),
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to change nickname',
        required: true
      },
      {
        name: 'nickname',
        type: 3,
        description: 'New nickname (leave empty to reset)',
        required: false
      }
    ]
  },
  {
    name: 'announce',
    description: 'Send an announcement to a channel',
    default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    options: [
      {
        name: 'channel',
        type: 7,
        description: 'Channel to send announcement',
        required: true
      },
      {
        name: 'message',
        type: 3,
        description: 'Announcement message',
        required: true
      },
      {
        name: 'ping_everyone',
        type: 5,
        description: 'Ping @everyone',
        required: false
      }
    ]
  },
  {
    name: 'modstats',
    description: 'View moderation statistics',
    default_member_permissions: PermissionFlagsBits.ModerateMembers.toString()
  },
  {
    name: 'bans',
    description: 'List all banned users',
    default_member_permissions: PermissionFlagsBits.BanMembers.toString()
  }
];

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(`Successfully reloaded ${commands.length} application (/) commands globally.`);
    console.log(`\n✅ Total: ${commands.length} commands`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();