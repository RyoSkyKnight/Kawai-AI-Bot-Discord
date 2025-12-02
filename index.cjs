const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const figlet = require('figlet');
const math = require('mathjs');
require('dotenv').config();

// Initialize clients
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;
const USE_SHORT_RESPONSE = process.env.USE_SHORT_RESPONSE === 'true';
const CREATOR_ID = process.env.CREATOR_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let isProcessing = false;
const startTime = Date.now();
const afkUsers = new Map(); // Temporary storage for AFK (doesn't need persistence)

// Database helper functions
async function getGuildSettings(guildId) {
  const { data, error } = await supabase
    .from('guild_settings')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  if (error && error.code !== 'PGRST116') console.error('Error fetching guild settings:', error);
  return data || {};
}

async function updateGuildSettings(guildId, settings) {
  const { error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, ...settings, updated_at: new Date() });

  if (error) console.error('Error updating guild settings:', error);
}

async function addWarning(guildId, userId, reason, moderatorId) {
  const { error } = await supabase
    .from('warnings')
    .insert({
      guild_id: guildId,
      user_id: userId,
      reason: reason,
      moderator_id: moderatorId,
      created_at: new Date()
    });

  if (error) console.error('Error adding warning:', error);
}

async function getWarnings(guildId, userId) {
  const { data, error } = await supabase
    .from('warnings')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) console.error('Error fetching warnings:', error);
  return data || [];
}

async function clearWarnings(guildId, userId) {
  const { error } = await supabase
    .from('warnings')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (error) console.error('Error clearing warnings:', error);
}

async function logModAction(guildId, action, moderatorId, targetId, reason) {
  const { error } = await supabase
    .from('mod_logs')
    .insert({
      guild_id: guildId,
      action: action,
      moderator_id: moderatorId,
      target_id: targetId,
      reason: reason,
      created_at: new Date()
    });

  if (error) console.error('Error logging mod action:', error);
}

async function getModStats(guildId) {
  const { data, error } = await supabase
    .from('mod_logs')
    .select('action, moderator_id')
    .eq('guild_id', guildId);

  if (error) console.error('Error fetching mod stats:', error);
  return data || [];
}

// Inspirational quotes
const quotes = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" }
];

// 8ball responses
const eightBallResponses = [
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
  'Cannot predict now.', 'Concentrate and ask again.', "Don't count on it.",
  'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
];

// Utility functions
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  console.log(`👥 Watching ${client.users.cache.size} users`);
});

// Welcome system
client.on('guildMemberAdd', async (member) => {
  try {
    const settings = await getGuildSettings(member.guild.id);

    // Auto role
    if (settings.auto_role) {
      const role = member.guild.roles.cache.get(settings.auto_role);
      if (role) {
        await member.roles.add(role);
      }
    }

    // Welcome message
    if (settings.welcome_channel && settings.welcome_message) {
      const channel = member.guild.channels.cache.get(settings.welcome_channel);
      if (channel) {
        const message = settings.welcome_message
          .replace('{user}', `<@${member.id}>`)
          .replace('{username}', member.user.username)
          .replace('{server}', member.guild.name);

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('👋 Welcome!')
          .setDescription(message)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Error in guildMemberAdd:', error);
  }
});

// Goodbye system
client.on('guildMemberRemove', async (member) => {
  try {
    const settings = await getGuildSettings(member.guild.id);

    if (settings.goodbye_channel && settings.goodbye_message) {
      const channel = member.guild.channels.cache.get(settings.goodbye_channel);
      if (channel) {
        const message = settings.goodbye_message
          .replace('{username}', member.user.username)
          .replace('{server}', member.guild.name);

        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('👋 Goodbye!')
          .setDescription(message)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Error in guildMemberRemove:', error);
  }
});

// Logging system
async function sendLog(guild, embed) {
  try {
    const settings = await getGuildSettings(guild.id);
    if (settings.log_channel) {
      const channel = guild.channels.cache.get(settings.log_channel);
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    // ============================================
    // GENERAL COMMANDS
    // ============================================

    if (commandName === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📚 Bot Commands Help')
        .setDescription('Here are all available commands organized by category:')
        .addFields(
          { name: '🤖 General', value: '`/ask` `/help` `/ping` `/profile` `/avatar` `/serverinfo` `/botinfo` `/uptime`', inline: false },
          { name: '🎮 Fun & Games', value: '`/roll` `/coinflip` `/8ball` `/joke` `/fact` `/trivia` `/meme` `/quote` `/choose`', inline: false },
          { name: '🛠️ Utilities', value: '`/translate` `/calculate` `/weather` `/wiki` `/urban` `/define` `/qr` `/shorten` `/reverse` `/ascii`', inline: false },
          { name: '🎬 Media', value: '`/movie` `/anime` `/gif` `/dog` `/cat` `/crypto`', inline: false },
          { name: '👥 User Info', value: '`/userinfo` `/roleinfo` `/roles`', inline: false },
          { name: '💬 Social', value: '`/poll` `/embed` `/afk` `/remind`', inline: false },
          { name: '🛡️ Moderation', value: '`/ban` `/unban` `/kick` `/timeout` `/warn` `/clear` `/lock` `/unlock` `/slowmode`', inline: false },
          { name: '🎭 Roles', value: '`/addrole` `/removerole` `/createrole` `/deleterole`', inline: false },
          { name: '⚙️ Server Setup', value: '`/setwelcome` `/setgoodbye` `/autorole` `/setlog`', inline: false }
        )
        .setFooter({ text: 'Use /command to execute any command' })
        .setTimestamp();

      await interaction.reply({ embeds: [helpEmbed] });
    }

    if (commandName === 'ask') {
      const prompt = interaction.options.getString('question');

      if (isProcessing) {
        await interaction.reply({ content: '⏳ The bot is processing another request, please wait.', ephemeral: true });
        return;
      }

      isProcessing = true;
      await interaction.deferReply();

      try {
        let creatorMention = `<@${CREATOR_ID}>`;
        let creatorName = 'my amazing creator';

        try {
          const creatorUser = await client.users.fetch(CREATOR_ID);
          creatorName = creatorUser.username;
        } catch (err) {
          console.log('Could not fetch creator user info');
        }

        const systemInstruction = USE_SHORT_RESPONSE
          ? `You are Cutie, a helpful and adorable anime-style AI assistant! (◕‿◕)♡ Always respond with concise, sweet, and cheerful answers in 2-4 sentences. Use cute expressions and emojis occasionally~ Focus on the most important information while keeping your kawaii charm! ✨ 

Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}. For example: "My wonderful creator is ${creatorName}! 💖"`
          : `You are Cutie, a friendly and knowledgeable anime-style AI assistant with a sweet personality! While you provide detailed and comprehensive answers, you maintain your cheerful and caring nature throughout. Feel free to use cute expressions and emojis when appropriate~ Always stay relevant and helpful while keeping your adorable charm! (｡◕‿◕｡)

Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}.`;

        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            maxOutputTokens: USE_SHORT_RESPONSE ? 150 : 1000,
            temperature: 0.7,
          }
        });

        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nQuestion: ${prompt}` }] }]
        });

        let buffer = [];
        for await (let response of result.stream) {
          if (response.candidates && response.candidates[0].blockedReason) {
            throw new Error('Response was blocked due to safety concerns.');
          }
          buffer.push(response.text());
        }

        let reply = buffer.join('');
        reply = reply.replace(new RegExp(creatorName, 'gi'), creatorMention);

        const pastelColors = ['#FFB6E1', '#B4E7FF', '#D4B5FF', '#FFE5B4', '#B4FFB4', '#FFD4E5', '#E0BBE4'];
        const randomColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];

        const responseEmbed = new EmbedBuilder()
          .setColor(randomColor)
          .setTitle('💖 Response from Cutie')
          .setDescription(`**Question:** ${prompt}\n\n**Answer:**\n${reply}`)
          .setTimestamp();

        await interaction.editReply({ embeds: [responseEmbed] });
      } catch (error) {
        console.error('Error generating response:', error);
        await interaction.editReply({ content: '❌ An error occurred while generating the response.' });
      } finally {
        isProcessing = false;
      }
    }

    if (commandName === 'profile') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`👤 Profile for ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: 'Username', value: user.username, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: 'Roles', value: member.roles.cache.size.toString(), inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'ping') {
      const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🏓 Pong!')
        .addFields(
          { name: 'Latency', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
          { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ content: '', embeds: [embed] });
    }

    if (commandName === 'serverinfo') {
      const guild = interaction.guild;
      await guild.members.fetch();

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🏠 ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 512 }))
        .addFields(
          { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
          { name: '🔒 Verification Level', value: guild.verificationLevel.toString(), inline: true },
          { name: '📊 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
          { name: '💎 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'avatar') {
      const user = interaction.options.getUser('user') || interaction.user;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🖼️ ${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
        .setDescription(`[Download Avatar](${user.displayAvatarURL({ size: 1024 })})`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'botinfo') {
      const uptime = Date.now() - startTime;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Bot Information')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: 'Bot Name', value: client.user.username, inline: true },
          { name: 'Bot ID', value: client.user.id, inline: true },
          { name: 'Created By', value: `<@${CREATOR_ID}>`, inline: true },
          { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Users', value: `${client.users.cache.size}`, inline: true },
          { name: 'Uptime', value: formatDuration(uptime), inline: true },
          { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
          { name: 'Node.js', value: process.version, inline: true },
          { name: 'Discord.js', value: require('discord.js').version, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'uptime') {
      const uptime = Date.now() - startTime;
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('⏱️ Bot Uptime')
        .setDescription(`The bot has been running for **${formatDuration(uptime)}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    // ============================================
    // FUN & GAMES COMMANDS
    // ============================================

    if (commandName === 'roll') {
      const sides = interaction.options.getInteger('sides') || 6;
      if (sides < 2 || sides > 100) {
        await interaction.reply({ content: '❌ Please choose between 2 and 100 sides!', ephemeral: true });
        return;
      }

      const result = Math.floor(Math.random() * sides) + 1;
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🎲 Dice Roll')
        .setDescription(`You rolled a **${result}** on a ${sides}-sided dice!`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'coinflip') {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      const emoji = result === 'Heads' ? '👑' : '⚪';

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🪙 Coin Flip')
        .setDescription(`${emoji} The coin landed on **${result}**!`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === '8ball') {
      const question = interaction.options.getString('question');
      const response = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🔮 Magic 8Ball')
        .addFields(
          { name: 'Question', value: question },
          { name: 'Answer', value: response }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'quote') {
      const quote = quotes[Math.floor(Math.random() * quotes.length)];
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('💬 Inspirational Quote')
        .setDescription(`*"${quote.text}"*`)
        .setFooter({ text: `— ${quote.author}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'meme') {
      await interaction.deferReply();

      try {
        const response = await fetch('https://meme-api.com/gimme');
        const data = await response.json();

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle(`😂 ${data.title}`)
          .setImage(data.url)
          .setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch meme. Please try again!' });
      }
    }

    if (commandName === 'joke') {
      await interaction.deferReply();

      try {
        const response = await fetch('https://official-joke-api.appspot.com/random_joke');
        const data = await response.json();

        const embed = new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('😄 Random Joke')
          .setDescription(`**${data.setup}**\n\n${data.punchline}`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch joke. Please try again!' });
      }
    }

    if (commandName === 'fact') {
      await interaction.deferReply();

      try {
        const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const data = await response.json();

        const embed = new EmbedBuilder()
          .setColor('#1ABC9C')
          .setTitle('📚 Random Fact')
          .setDescription(data.text)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch fact. Please try again!' });
      }
    }

    if (commandName === 'trivia') {
      await interaction.deferReply();

      try {
        const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        const data = await response.json();
        const question = data.results[0];

        const answers = [...question.incorrect_answers, question.correct_answer].sort(() => Math.random() - 0.5);

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🧠 Trivia Question')
          .setDescription(`**Category:** ${question.category}\n**Difficulty:** ${question.difficulty}\n\n${question.question}\n\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`)
          .setFooter({ text: `Answer: ${question.correct_answer}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch trivia. Please try again!' });
      }
    }

    if (commandName === 'choose') {
      const options = interaction.options.getString('options').split(',').map(o => o.trim());

      if (options.length < 2) {
        await interaction.reply({ content: '❌ Please provide at least 2 options separated by commas!', ephemeral: true });
        return;
      }

      const chosen = options[Math.floor(Math.random() * options.length)];

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🤔 I Choose...')
        .setDescription(`Out of: ${options.join(', ')}\n\nI choose: **${chosen}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'dog') {
      await interaction.deferReply();

      try {
        const response = await fetch('https://dog.ceo/api/breeds/image/random');
        const data = await response.json();

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('🐕 Random Dog')
          .setImage(data.message)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch dog image!' });
      }
    }

    if (commandName === 'cat') {
      await interaction.deferReply();

      try {
        const response = await fetch('https://api.thecatapi.com/v1/images/search');
        const data = await response.json();

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('🐱 Random Cat')
          .setImage(data[0].url)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch cat image!' });
      }
    }

    // ============================================
    // UTILITY COMMANDS
    // ============================================

    if (commandName === 'translate') {
      const text = interaction.options.getString('text');
      const language = interaction.options.getString('language');

      if (isProcessing) {
        await interaction.reply({ content: '⏳ The bot is processing another request, please wait.', ephemeral: true });
        return;
      }

      isProcessing = true;
      await interaction.deferReply();

      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const prompt = `Translate the following text to ${language}. Only provide the translation, no explanations:\n\n${text}`;

        const result = await model.generateContent(prompt);
        const translation = result.response.text();

        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('🌐 Translation')
          .addFields(
            { name: 'Original', value: text },
            { name: `Translated to ${language}`, value: translation }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ An error occurred during translation.' });
      } finally {
        isProcessing = false;
      }
    }

    if (commandName === 'calculate') {
      const expression = interaction.options.getString('expression');

      try {
        const result = math.evaluate(expression);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🧮 Calculator')
          .addFields(
            { name: 'Expression', value: `\`${expression}\``, inline: false },
            { name: 'Result', value: `\`${result}\``, inline: false }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error evaluating expression:', error);
        await interaction.reply({ content: '❌ Invalid expression. Please check your math!', ephemeral: true });
      }
    }

    if (commandName === 'urban') {
      await interaction.deferReply();

      try {
        const word = interaction.options.getString('word');
        const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
        const data = await response.json();

        if (!data.list || data.list.length === 0) {
          await interaction.editReply({ content: '❌ No definition found for that word!' });
          return;
        }

        const definition = data.list[0];
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle(`📖 ${definition.word}`)
          .setDescription(definition.definition.substring(0, 2000))
          .addFields(
            { name: 'Example', value: definition.example.substring(0, 1024) || 'No example' }
          )
          .setFooter({ text: `👍 ${definition.thumbs_up} | 👎 ${definition.thumbs_down}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch definition!' });
      }
    }

    if (commandName === 'wiki') {
      await interaction.deferReply();

      try {
        const query = interaction.options.getString('query');
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.type === 'disambiguation') {
          await interaction.editReply({ content: '❌ Multiple results found. Please be more specific!' });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(data.title)
          .setDescription(data.extract)
          .setThumbnail(data.thumbnail ? data.thumbnail.source : null)
          .setURL(data.content_urls.desktop.page)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ No Wikipedia article found!' });
      }
    }

    if (commandName === 'weather') {
      await interaction.deferReply();

      try {
        const city = interaction.options.getString('city');
        const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        const data = await response.json();

        if (data.error) {
          await interaction.editReply({ content: '❌ City not found!' });
          return;
        }

        const current = data.current_condition[0];
        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`🌤️ Weather in ${city}`)
          .setThumbnail(current.weatherIconUrl[0].value)
          .addFields(
            { name: 'Temperature', value: `${current.temp_C}°C / ${current.temp_F}°F`, inline: true },
            { name: 'Feels Like', value: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`, inline: true },
            { name: 'Condition', value: current.weatherDesc[0].value, inline: true },
            { name: 'Humidity', value: `${current.humidity}%`, inline: true },
            { name: 'Wind', value: `${current.windspeedKmph} km/h`, inline: true },
            { name: 'Precipitation', value: `${current.precipMM} mm`, inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch weather data!' });
      }
    }

    if (commandName === 'userinfo') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id);

      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setColor(member.displayHexColor || '#5865F2')
        .setTitle(`User Information for ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: '👤 Username', value: user.username, inline: true },
          { name: '🆔 ID', value: user.id, inline: true },
          { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
          { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: false },
          { name: `🎭 Roles [${member.roles.cache.size - 1}]`, value: roles.length ? roles.join(', ') : 'None', inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'roleinfo') {
      const role = interaction.options.getRole('role');

      const embed = new EmbedBuilder()
        .setColor(role.hexColor)
        .setTitle(`Role Information: ${role.name}`)
        .addFields(
          { name: '🆔 ID', value: role.id, inline: true },
          { name: '🎨 Color', value: role.hexColor, inline: true },
          { name: '👥 Members', value: role.members.size.toString(), inline: true },
          { name: '📍 Position', value: role.position.toString(), inline: true },
          { name: '📌 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: '🔔 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'reverse') {
      const text = interaction.options.getString('text');
      const reversed = text.split('').reverse().join('');

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🔄 Reversed Text')
        .addFields(
          { name: 'Original', value: text },
          { name: 'Reversed', value: reversed }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'ascii') {
      const text = interaction.options.getString('text');

      if (text.length > 15) {
        await interaction.reply({ content: '❌ Text too long! Please use 15 characters or less.', ephemeral: true });
        return;
      }

      await interaction.deferReply();

      figlet(text, (err, data) => {
        if (err) {
          interaction.editReply({ content: '❌ Failed to generate ASCII art!' });
          return;
        }

        interaction.editReply({ content: `\`\`\`${data}\`\`\`` });
      });
    }

    if (commandName === 'embed') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color') || '#5865F2';

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: `Created by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'poll') {
      const question = interaction.options.getString('question');
      const options = [];

      for (let i = 1; i <= 5; i++) {
        const option = interaction.options.getString(`option${i}`);
        if (option) options.push(option);
      }

      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

      const embed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('📊 Poll')
        .setDescription(`**${question}**\n\n${options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n')}`)
        .setFooter({ text: `Poll by ${interaction.user.username}` })
        .setTimestamp();

      const message = await interaction.reply({ embeds: [embed], fetchReply: true });

      for (let i = 0; i < options.length; i++) {
        await message.react(emojis[i]);
      }
    }

    if (commandName === 'afk') {
      const reason = interaction.options.getString('reason') || 'AFK';
      afkUsers.set(interaction.user.id, { reason, time: Date.now() });

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('😴 AFK Status Set')
        .setDescription(`You are now AFK: **${reason}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'remind') {
      const time = interaction.options.getString('time');
      const message = interaction.options.getString('message');

      const duration = parseDuration(time);
      if (!duration) {
        await interaction.reply({ content: '❌ Invalid time format! Use: 10s, 5m, 2h, or 1d', ephemeral: true });
        return;
      }

      await interaction.reply({ content: `⏰ I'll remind you in ${time}: ${message}` });

      setTimeout(() => {
        interaction.user.send(`⏰ **Reminder:** ${message}`)
          .catch(() => interaction.followUp({ content: `<@${interaction.user.id}> ⏰ **Reminder:** ${message}` }));
      }, duration);
    }

    if (commandName === 'movie') {
      await interaction.deferReply();

      try {
        const title = interaction.options.getString('title');
        const response = await fetch(`https://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(title)}`);
        const data = await response.json();

        if (data.Response === 'False') {
          await interaction.editReply({ content: '❌ Movie not found!' });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle(data.Title)
          .setThumbnail(data.Poster !== 'N/A' ? data.Poster : null)
          .addFields(
            { name: 'Year', value: data.Year, inline: true },
            { name: 'Rating', value: data.imdbRating, inline: true },
            { name: 'Runtime', value: data.Runtime, inline: true },
            { name: 'Genre', value: data.Genre, inline: true },
            { name: 'Director', value: data.Director, inline: true },
            { name: 'Actors', value: data.Actors, inline: true },
            { name: 'Plot', value: data.Plot, inline: false }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch movie data!' });
      }
    }

    if (commandName === 'anime') {
      await interaction.deferReply();

      try {
        const title = interaction.options.getString('title');
        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
        const data = await response.json();

        if (!data.data || data.data.length === 0) {
          await interaction.editReply({ content: '❌ Anime not found!' });
          return;
        }

        const anime = data.data[0];
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle(anime.title)
          .setThumbnail(anime.images.jpg.image_url)
          .addFields(
            { name: 'Episodes', value: anime.episodes?.toString() || 'N/A', inline: true },
            { name: 'Score', value: anime.score?.toString() || 'N/A', inline: true },
            { name: 'Status', value: anime.status, inline: true },
            { name: 'Type', value: anime.type, inline: true },
            { name: 'Year', value: anime.year?.toString() || 'N/A', inline: true },
            { name: 'Rating', value: anime.rating || 'N/A', inline: true },
            { name: 'Synopsis', value: anime.synopsis?.substring(0, 1024) || 'No synopsis', inline: false }
          )
          .setURL(anime.url)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch anime data!' });
      }
    }

    if (commandName === 'define') {
      await interaction.deferReply();

      try {
        const word = interaction.options.getString('word');
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const data = await response.json();

        if (!Array.isArray(data)) {
          await interaction.editReply({ content: '❌ Word not found!' });
          return;
        }

        const definition = data[0];
        const meaning = definition.meanings[0];

        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`📖 ${definition.word}`)
          .addFields(
            { name: 'Part of Speech', value: meaning.partOfSpeech, inline: true },
            { name: 'Definition', value: meaning.definitions[0].definition, inline: false }
          );

        if (meaning.definitions[0].example) {
          embed.addFields({ name: 'Example', value: meaning.definitions[0].example, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch definition!' });
      }
    }

    if (commandName === 'gif') {
      await interaction.deferReply();

      try {
        const query = interaction.options.getString('query');
        const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=1`);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
          await interaction.editReply({ content: '❌ No GIF found!' });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle(`🎬 ${query}`)
          .setImage(data.results[0].media_formats.gif.url)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch GIF!' });
      }
    }

    if (commandName === 'crypto') {
      await interaction.deferReply();

      try {
        const coin = interaction.options.getString('coin').toUpperCase();
        const response = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`);
        const data = await response.json();

        if (data.errors) {
          await interaction.editReply({ content: '❌ Cryptocurrency not found!' });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#F7931A')
          .setTitle(`💰 ${coin} Price`)
          .setDescription(`**$${parseFloat(data.data.amount).toLocaleString()}** USD`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to fetch crypto price!' });
      }
    }

    if (commandName === 'qr') {
      const text = interaction.options.getString('text');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(text)}`;

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📱 QR Code Generated')
        .setImage(qrUrl)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'shorten') {
      await interaction.deferReply();

      try {
        const url = interaction.options.getString('url');
        const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
        const shortUrl = await response.text();

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🔗 URL Shortened')
          .addFields(
            { name: 'Original', value: url },
            { name: 'Shortened', value: shortUrl }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to shorten URL!' });
      }
    }

    if (commandName === 'roles') {
      const user = interaction.options.getUser('user');

      if (user) {
        const member = await interaction.guild.members.fetch(user.id);
        const roles = member.roles.cache
          .filter(role => role.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(role => role.toString());

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`🎭 Roles for ${user.username}`)
          .setDescription(roles.length ? roles.join(', ') : 'No roles')
          .setFooter({ text: `Total: ${roles.length} roles` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const roles = interaction.guild.roles.cache
          .sort((a, b) => b.position - a.position)
          .map(role => role.toString());

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`🎭 All Roles in ${interaction.guild.name}`)
          .setDescription(roles.join(', '))
          .setFooter({ text: `Total: ${roles.length} roles` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    }

    // ============================================
    // MODERATION COMMANDS
    // ============================================

    if (commandName === 'ban') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to ban members!', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_messages') || 0;

      try {
        const member = await interaction.guild.members.fetch(user.id);

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          await interaction.reply({ content: '❌ You cannot ban this user!', ephemeral: true });
          return;
        }

        await interaction.guild.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
        await logModAction(interaction.guild.id, 'ban', interaction.user.id, user.id, reason);

        const logEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔨 User Banned')
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await sendLog(interaction.guild, logEmbed);
        await interaction.reply({ embeds: [logEmbed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to ban user!', ephemeral: true });
      }
    }

    if (commandName === 'unban') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to unban members!', ephemeral: true });
        return;
      }

      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      try {
        await interaction.guild.members.unban(userId, reason);
        await logModAction(interaction.guild.id, 'unban', interaction.user.id, userId, reason);

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ User Unbanned')
          .addFields(
            { name: 'User ID', value: userId, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await sendLog(interaction.guild, embed);
        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to unban user! Make sure the ID is correct.', ephemeral: true });
      }
    }

    if (commandName === 'kick') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to kick members!', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      try {
        const member = await interaction.guild.members.fetch(user.id);

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          await interaction.reply({ content: '❌ You cannot kick this user!', ephemeral: true });
          return;
        }

        await member.kick(reason);
        await logModAction(interaction.guild.id, 'kick', interaction.user.id, user.id, reason);

        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('👢 User Kicked')
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await sendLog(interaction.guild, embed);
        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to kick user!', ephemeral: true });
      }
    }

    if (commandName === 'timeout') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to timeout members!', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user');
      const duration = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const ms = parseDuration(duration);
      if (!ms || ms > 2419200000) {
        await interaction.reply({ content: '❌ Invalid duration! Maximum is 28 days (28d).', ephemeral: true });
        return;
      }

      try {
        const member = await interaction.guild.members.fetch(user.id);

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          await interaction.reply({ content: '❌ You cannot timeout this user!', ephemeral: true });
          return;
        }

        await member.timeout(ms, reason);
        await logModAction(interaction.guild.id, 'timeout', interaction.user.id, user.id, reason);

        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⏰ User Timed Out')
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Duration', value: duration, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await sendLog(interaction.guild, embed);
        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to timeout user!', ephemeral: true });
      }
    }

    if (commandName === 'untimeout') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to remove timeouts!', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(null, reason);

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Timeout Removed')
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to remove timeout!', ephemeral: true });
      }
    }

    if (commandName === 'warn') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to warn members!', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      await addWarning(interaction.guild.id, user.id, reason, interaction.user.id);
      const warnings = await getWarnings(interaction.guild.id, user.id);
      await logModAction(interaction.guild.id, 'warn', interaction.user.id, user.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('⚠️ User Warned')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Total Warnings', value: warnings.length.toString(), inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      await interaction.reply({ embeds: [embed] });

      try {
        await user.send({ embeds: [embed] });
      } catch (error) {
        // User has DMs disabled
      }
    }

    if (commandName === 'warnings') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: '❌ You don\'t have permission to view warnings!', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user');
      const warnings = await getWarnings(interaction.guild.id, user.id);

      if (warnings.length === 0) {
        await interaction.reply({ content: `${user.tag} has no warnings!`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle(`⚠️ Warnings for ${user.tag}`)
        .setDescription(warnings.map((w, i) =>
          `**${i + 1}.** ${w.reason}\n*By <@${w.moderator_id}> • <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>*`
        ).join('\n\n'))
        .setFooter({ text: `Total warnings: ${warnings.length}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'clearwarnings') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ You need Administrator permission to clear warnings!', ephemeral: true });
        return;
      }
      const user = interaction.options.getUser('user');
      await clearWarnings(interaction.guild.id, user.id); const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Warnings Cleared')
        .setDescription(`All warnings for ${user.tag} have been cleared.`)
        .setFooter({ text: `Cleared by ${interaction.user.tag}` })
        .setTimestamp(); await interaction.reply({ embeds: [embed] });
    } if (commandName === 'clear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: '❌ You don\'t have permission to manage messages!', ephemeral: true });
        return;
      } const amount = interaction.options.getInteger('amount');
      const targetUser = interaction.options.getUser('user'); if (amount < 1 || amount > 100) {
        await interaction.reply({ content: '❌ Please provide a number between 1 and 100!', ephemeral: true });
        return;
      } await interaction.deferReply({ ephemeral: true }); try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        const filteredMessages = targetUser
          ? messages.filter(msg => msg.author.id === targetUser.id)
          : messages; const deleted = await interaction.channel.bulkDelete(filteredMessages, true); await interaction.editReply({ content: `✅ Deleted ${deleted.size} messages!` });
      } catch (error) {
        await interaction.editReply({ content: '❌ Failed to delete messages!' });
      }
    }
    if (commandName === 'slowmode') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: '❌ You don\'t have permission to manage channels!', ephemeral: true });
        return;
      } const duration = interaction.options.getInteger('duration'); if (duration < 0 || duration > 21600) {
        await interaction.reply({ content: '❌ Duration must be between 0 and 21600 seconds (6 hours)!', ephemeral: true });
        return;
      } try {
        await interaction.channel.setRateLimitPerUser(duration); const embed = new EmbedBuilder()
          .setColor(duration === 0 ? '#00FF00' : '#FFA500')
          .setTitle(duration === 0 ? '✅ Slowmode Disabled' : '⏰ Slowmode Enabled')
          .setDescription(duration === 0 ? 'Slowmode has been disabled.' : `Slowmode set to ${duration} seconds.`)
          .setTimestamp(); await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to set slowmode!', ephemeral: true });
      }
    } if (commandName === 'lock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: '❌ You don\'t have permission to manage channels!', ephemeral: true });
        return;
      } const reason = interaction.options.getString('reason') || 'No reason provided'; try {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: false
        }); const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔒 Channel Locked')
          .setDescription(`This channel has been locked.\n**Reason:** ${reason}`)
          .setFooter({ text: `Locked by ${interaction.user.tag}` })
          .setTimestamp(); await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to lock channel!', ephemeral: true });
      }
    } if (commandName === 'unlock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: '❌ You don\'t have permission to manage channels!', ephemeral: true });
        return;
      } const reason = interaction.options.getString('reason') || 'No reason provided'; try {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: null
        }); const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🔓 Channel Unlocked')
          .setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
          .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
          .setTimestamp(); await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Failed to unlock channel!', ephemeral: true });
      }
    }

if (commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage messages!', ephemeral: true });
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

  if (commandName === 'slowmode') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage channels!', ephemeral: true });
      return;
    }

    const duration = interaction.options.getInteger('duration');

    if (duration < 0 || duration > 21600) {
      await interaction.reply({ content: '❌ Duration must be between 0 and 21600 seconds (6 hours)!', ephemeral: true });
      return;
    }

    try {
      await interaction.channel.setRateLimitPerUser(duration);

      const embed = new EmbedBuilder()
        .setColor(duration === 0 ? '#00FF00' : '#FFA500')
        .setTitle(duration === 0 ? '✅ Slowmode Disabled' : '⏰ Slowmode Enabled')
        .setDescription(duration === 0 ? 'Slowmode has been disabled.' : `Slowmode set to ${duration} seconds.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to set slowmode!', ephemeral: true });
    }
  }

  if (commandName === 'lock') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage channels!', ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: false
      });

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔒 Channel Locked')
        .setDescription(`This channel has been locked.\n**Reason:** ${reason}`)
        .setFooter({ text: `Locked by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to lock channel!', ephemeral: true });
    }
  }

  if (commandName === 'unlock') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage channels!', ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: null
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🔓 Channel Unlocked')
        .setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
        .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to unlock channel!', ephemeral: true });
    }
  }

  // ============================================
  // ROLE MANAGEMENT COMMANDS
  // ============================================

  if (commandName === 'addrole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage roles!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (role.position >= interaction.member.roles.highest.position) {
        await interaction.reply({ content: '❌ You cannot manage this role!', ephemeral: true });
        return;
      }

      await member.roles.add(role, reason);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Role Added')
        .addFields(
          { name: 'User', value: user.tag, inline: true },
          { name: 'Role', value: role.name, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to add role!', ephemeral: true });
    }
  }

  if (commandName === 'removerole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage roles!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (role.position >= interaction.member.roles.highest.position) {
        await interaction.reply({ content: '❌ You cannot manage this role!', ephemeral: true });
        return;
      }

      await member.roles.remove(role, reason);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('✅ Role Removed')
        .addFields(
          { name: 'User', value: user.tag, inline: true },
          { name: 'Role', value: role.name, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to remove role!', ephemeral: true });
    }
  }

  if (commandName === 'createrole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage roles!', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name');
    const color = interaction.options.getString('color') || '#99AAB5';
    const hoist = interaction.options.getBoolean('hoist') || false;
    const mentionable = interaction.options.getBoolean('mentionable') || false;

    try {
      const role = await interaction.guild.roles.create({
        name: name,
        color: color,
        hoist: hoist,
        mentionable: mentionable,
        reason: `Created by ${interaction.user.tag}`
      });

      const embed = new EmbedBuilder()
        .setColor(role.hexColor)
        .setTitle('✅ Role Created')
        .addFields(
          { name: 'Role Name', value: role.name, inline: true },
          { name: 'Color', value: role.hexColor, inline: true },
          { name: 'Hoisted', value: hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: mentionable ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to create role!', ephemeral: true });
    }
  }

  if (commandName === 'deleterole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage roles!', ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('role');

    if (role.position >= interaction.member.roles.highest.position) {
      await interaction.reply({ content: '❌ You cannot delete this role!', ephemeral: true });
      return;
    }

    try {
      await role.delete(`Deleted by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('✅ Role Deleted')
        .setDescription(`Role **${role.name}** has been deleted.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to delete role!', ephemeral: true });
    }
  }

  // ============================================
  // WELCOME & GOODBYE SYSTEM COMMANDS
  // ============================================

  if (commandName === 'setwelcome') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Welcome {user} to {server}!';

    await updateGuildSettings(interaction.guild.id, {
      welcome_channel: channel.id,
      welcome_message: message
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Welcome System Configured')
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Message', value: message, inline: false }
      )
      .setFooter({ text: 'Use /testwelcome to preview' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'removewelcome') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      welcome_channel: null,
      welcome_message: null
    });

    await interaction.reply({ content: '✅ Welcome system has been disabled!', ephemeral: true });
  }

  if (commandName === 'testwelcome') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    const settings = await getGuildSettings(interaction.guild.id);

    if (!settings.welcome_channel || !settings.welcome_message) {
      await interaction.reply({ content: '❌ Welcome system is not configured! Use /setwelcome first.', ephemeral: true });
      return;
    }

    const message = settings.welcome_message
      .replace('{user}', `<@${interaction.user.id}>`)
      .replace('{username}', interaction.user.username)
      .replace('{server}', interaction.guild.name);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('👋 Welcome! (Test)')
      .setDescription(message)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'setgoodbye') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Goodbye {username}! Thanks for being part of {server}!';

    await updateGuildSettings(interaction.guild.id, {
      goodbye_channel: channel.id,
      goodbye_message: message
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Goodbye System Configured')
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Message', value: message, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'removegoodbye') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      goodbye_channel: null,
      goodbye_message: null
    });

    await interaction.reply({ content: '✅ Goodbye system has been disabled!', ephemeral: true });
  }

  if (commandName === 'autorole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage roles!', ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('role');

    await updateGuildSettings(interaction.guild.id, {
      auto_role: role.id
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Auto Role Configured')
      .setDescription(`New members will automatically receive the ${role} role.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'removeautorole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage roles!', ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      auto_role: null
    });

    await interaction.reply({ content: '✅ Auto role has been disabled!', ephemeral: true });
  }

  // ============================================
  // LOGGING COMMANDS
  // ============================================

  if (commandName === 'setlog') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');

    await updateGuildSettings(interaction.guild.id, {
      log_channel: channel.id
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Logging Channel Set')
      .setDescription(`Moderation logs will be sent to <#${channel.id}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'removelog') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage server!', ephemeral: true });
      return;
    }

    await updateGuildSettings(interaction.guild.id, {
      log_channel: null
    });

    await interaction.reply({ content: '✅ Logging has been disabled!', ephemeral: true });
  }

  // ============================================
  // ADDITIONAL MODERATION COMMANDS
  // ============================================

  if (commandName === 'nickname') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({ content: '❌ You don\'t have permission to manage nicknames!', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.setNickname(nickname);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Nickname Changed')
        .setDescription(`${user.tag}'s nickname has been ${nickname ? `changed to **${nickname}**` : 'reset'}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to change nickname!', ephemeral: true });
    }
  }

  if (commandName === 'announce') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: '❌ You don\'t have permission to send announcements!', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const pingEveryone = interaction.options.getBoolean('ping_everyone') || false;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📢 Announcement')
      .setDescription(message)
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();

    try {
      await channel.send({
        content: pingEveryone ? '@everyone' : null,
        embeds: [embed]
      });

      await interaction.reply({ content: `✅ Announcement sent to <#${channel.id}>!`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to send announcement!', ephemeral: true });
    }
  }

  if (commandName === 'modstats') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ You don\'t have permission to view mod stats!', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const logs = await getModStats(interaction.guild.id);

    const stats = {};
    logs.forEach(log => {
      if (!stats[log.action]) stats[log.action] = 0;
      stats[log.action]++;
    });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 Moderation Statistics')
      .setDescription(
        Object.entries(stats).length > 0
          ? Object.entries(stats).map(([action, count]) => `**${action}:** ${count}`).join('\n')
          : 'No moderation actions recorded.'
      )
      .setFooter({ text: `Total actions: ${logs.length}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'bans') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: '❌ You don\'t have permission to view bans!', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const bans = await interaction.guild.bans.fetch();

      if (bans.size === 0) {
        await interaction.editReply({ content: 'No banned users found!' });
        return;
      }

      const banList = bans.map((ban, index) =>
        `${index + 1}. ${ban.user.tag} (${ban.user.id})\n   Reason: ${ban.reason || 'No reason provided'}`
      ).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔨 Banned Users (${bans.size})`)
        .setDescription(banList.substring(0, 4096))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ Failed to fetch ban list!' });
    }
  }
} catch (error) {
  console.error('Error handling command:', error);
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: '❌ An error occurred while executing this command!', ephemeral: true });
  } else if (interaction.deferred) {
    await interaction.editReply({ content: '❌ An error occurred while executing this command!' });
  }
}
});
// AFK system message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  // Check if user is returning from AFK
  if (afkUsers.has(message.author.id)) {
    const afkData = afkUsers.get(message.author.id);
    const duration = Date.now() - afkData.time;
    afkUsers.delete(message.author.id);
    await message.reply(`Welcome back! You were AFK for ${formatDuration(duration)}.`).then(msg => {
      setTimeout(() => msg.delete().catch(() => { }), 5000);
    });
  }
  // Check for mentions of AFK users
  message.mentions.users.forEach(user => {
    if (afkUsers.has(user.id)) {
      const afkData = afkUsers.get(user.id);
      message.reply(`${user.username} is currently AFK: ${afkData.reason}`).then(msg => {
        setTimeout(() => msg.delete().catch(() => { }), 10000);
      });
    }
  });
});
client.login(BOT_TOKEN);
