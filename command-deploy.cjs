require('dotenv').config();

const { REST, Routes } = require('discord.js');

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
        type: 4, // INTEGER
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

    console.log('Successfully reloaded application (/) commands globally.');
  } catch (error) {
    console.error(error);
  }
})();