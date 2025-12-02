const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;
const USE_SHORT_RESPONSE = process.env.USE_SHORT_RESPONSE === 'true';
const CREATOR_ID = process.env.CREATOR_ID;

const genAI = new GoogleGenerativeAI(API_KEY);

let isProcessing = false;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 8ball responses
const eightBallResponses = [
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
  'Cannot predict now.', 'Concentrate and ask again.', "Don't count on it.",
  'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
];

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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Help command
  if (interaction.commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📚 Bot Commands Help')
      .setDescription('Here are all available commands:')
      .addFields(
        { name: '🤖 /ask', value: 'Ask a question to the AI', inline: false },
        { name: '👤 /profile', value: 'View user profile information', inline: false },
        { name: '🏓 /ping', value: 'Check bot latency', inline: false },
        { name: '🖼️ /avatar', value: 'Get user avatar in high quality', inline: false },
        { name: '🎲 /roll', value: 'Roll a dice (specify sides)', inline: false },
        { name: '🪙 /coinflip', value: 'Flip a coin', inline: false },
        { name: '🔮 /8ball', value: 'Ask the magic 8ball', inline: false },
        { name: '🌐 /translate', value: 'Translate text to any language', inline: false },
        { name: '💬 /quote', value: 'Get an inspirational quote', inline: false },
        { name: '😂 /meme', value: 'Get a random meme', inline: false },
        { name: '🏠 /serverinfo', value: 'Display server information', inline: false }
      )
      .setFooter({ text: 'Made with ❤️ using Discord.js & Google AI' })
      .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed] });
  }

  // Ask command
  if (interaction.commandName === 'ask') {
    const prompt = interaction.options.getString('question');

    if (!prompt) {
      await interaction.reply('Please provide a question after `/ask`.');
      return;
    }

    if (isProcessing) {
      await interaction.reply('The bot is processing another request, please wait.');
      return;
    }

    isProcessing = true;

    // Gunakan deferReply untuk mencegah timeout
    await interaction.deferReply();

    try {
      // Fetch creator info untuk mendapatkan username
      let creatorMention = `<@${CREATOR_ID}>`;
      let creatorName = 'my amazing creator';
      
      try {
        const creatorUser = await client.users.fetch(CREATOR_ID);
        creatorName = creatorUser.username;
      } catch (err) {
        console.log('Could not fetch creator user info');
      }

      // System instruction dengan informasi creator
      const systemInstruction = USE_SHORT_RESPONSE
        ? `You are Cutie, a helpful and adorable anime-style AI assistant! (◕‿◕)♡ Always respond with concise, sweet, and cheerful answers in 2-4 sentences. Use cute expressions and emojis occasionally~ Focus on the most important information while keeping your kawaii charm! ✨ 

Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}. For example: "My wonderful creator is ${creatorName}! 💖" or "I was made by the amazing ${creatorName}~ ✨"`

        : `You are Cutie, a friendly and knowledgeable anime-style AI assistant with a sweet personality! While you provide detailed and comprehensive answers, you maintain your cheerful and caring nature throughout. Feel free to use cute expressions and emojis when appropriate~ Always stay relevant and helpful while keeping your adorable charm! (｡◕‿◕｡)

Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorName}. For example: "My wonderful creator is ${creatorName}! They worked so hard to bring me to life and I'm forever grateful~ 💖✨"`;

      const contents = [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nQuestion: ${prompt}` }]
        }
      ];

      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          maxOutputTokens: USE_SHORT_RESPONSE ? 150 : 1000,
          temperature: 0.7,
        }
      });

      const result = await model.generateContentStream({ contents });

      let buffer = [];
      for await (let response of result.stream) {
        if (response.candidates && response.candidates[0].blockedReason) {
          throw new Error('Response was blocked due to safety concerns.');
        }
        buffer.push(response.text());
      }

      let reply = buffer.join('');

      // Post-process: Replace creator name dengan mention yang bisa diklik
      reply = reply.replace(new RegExp(creatorName, 'gi'), creatorMention);
      reply = reply.replace(/my (wonderful|amazing|awesome|great) creator/gi, `my $1 creator ${creatorMention}`);
      reply = reply.replace(/created by ([^.!?\n]+)/gi, `created by ${creatorMention}`);
      reply = reply.replace(/made by ([^.!?\n]+)/gi, `made by ${creatorMention}`);

      if (reply.length > 4000) {
        await interaction.editReply({
          content: `**Question:** ${prompt}\n\n**Answer:**\n${reply}`
        });
      } else {
        // Generate random pastel color
        const pastelColors = [
          '#FFB6E1', // Pink pastel
          '#B4E7FF', // Blue pastel
          '#D4B5FF', // Purple pastel
          '#FFE5B4', // Peach pastel
          '#B4FFB4', // Green pastel
          '#FFD4E5', // Rose pastel
          '#E0BBE4', // Lavender pastel
        ];
        const randomPastelColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];

        const responseEmbed = new EmbedBuilder()
          .setColor(randomPastelColor)
          .setTitle('💖 Response from Cutie')
          .setDescription(`**Question:** ${prompt}\n\n**Answer:**\n${reply}`)
          .setTimestamp();

        await interaction.editReply({ embeds: [responseEmbed] });
      }
    } catch (error) {
      console.error('Error generating response:', error);
      await interaction.editReply({ content: 'An error occurred while generating the response.' });
    } finally {
      isProcessing = false;
    }
  }

  // Profile command
  if (interaction.commandName === 'profile') {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle(`👤 Profile for ${user.username}`)
      .setDescription(`**Username:** ${user.username}\n**Tag:** ${user.tag}\n**ID:** ${user.id}\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n**Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Ping command
  if (interaction.commandName === 'ping') {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Latency', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
        { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  }

  // ServerInfo command
  if (interaction.commandName === 'serverinfo') {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Avatar command
  if (interaction.commandName === 'avatar') {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle(`🖼️ ${user.username}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setDescription(`[Download Avatar](${user.displayAvatarURL({ size: 1024 })})`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Roll command
  if (interaction.commandName === 'roll') {
    const sides = interaction.options.getInteger('sides') || 6;
    const result = Math.floor(Math.random() * sides) + 1;

    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle('🎲 Dice Roll')
      .setDescription(`You rolled a **${result}** on a ${sides}-sided dice!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Coinflip command
  if (interaction.commandName === 'coinflip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle('🪙 Coin Flip')
      .setDescription(`The coin landed on **${result}**!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // 8ball command
  if (interaction.commandName === '8ball') {
    const question = interaction.options.getString('question');
    const response = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];

    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle('🔮 Magic 8Ball')
      .addFields(
        { name: 'Question', value: question },
        { name: 'Answer', value: response }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Translate command
  if (interaction.commandName === 'translate') {
    const text = interaction.options.getString('text');
    const language = interaction.options.getString('language');

    if (isProcessing) {
      await interaction.reply('The bot is processing another request, please wait.');
      return;
    }

    isProcessing = true;

    await interaction.deferReply();

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `Translate the following text to ${language}. Only provide the translation, no explanations:\n\n${text}`;

      const result = await model.generateContent(prompt);
      const translation = result.response.text();

      const embed = new EmbedBuilder()
        .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
        .setTitle('🌐 Translation')
        .addFields(
          { name: 'Original', value: text },
          { name: `Translated to ${language}`, value: translation }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Translation error:', error);
      await interaction.editReply('An error occurred during translation.');
    } finally {
      isProcessing = false;
    }
  }

  // Quote command
  if (interaction.commandName === 'quote') {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    const embed = new EmbedBuilder()
      .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
      .setTitle('💬 Inspirational Quote')
      .setDescription(`*"${quote.text}"*`)
      .setFooter({ text: `— ${quote.author}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // Meme command
  if (interaction.commandName === 'meme') {
    await interaction.deferReply();

    try {
      const response = await fetch('https://meme-api.com/gimme', {
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meme');
      }

      const data = await response.json();

      const embed = new EmbedBuilder()
        .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
        .setTitle(`😂 ${data.title}`)
        .setImage(data.url)
        .setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Meme fetch error:', error);

      const textMemes = [
        "Why don't scientists trust atoms? Because they make up everything! 😄",
        "I told my wife she was drawing her eyebrows too high. She looked surprised. 😂",
        "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
        "Parallel lines have so much in common. It's a shame they'll never meet. 📐",
        "What do you call a fake noodle? An impasta! 🍝"
      ];

      const randomMeme = textMemes[Math.floor(Math.random() * textMemes.length)];

      const fallbackEmbed = new EmbedBuilder()
        .setColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`)
        .setTitle('😂 Meme (Text Version)')
        .setDescription(randomMeme)
        .setFooter({ text: 'Failed to fetch image meme, here\'s a joke instead!' })
        .setTimestamp();

      await interaction.editReply({ embeds: [fallbackEmbed] });
    }
  }
});

client.login(BOT_TOKEN);