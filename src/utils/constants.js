const pastelColors = ['#FFB6E1', '#B4E7FF', '#D4B5FF', '#FFE5B4', '#B4FFB4', '#FFD4E5', '#E0BBE4'];

const quotes = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" }
];

const eightBallResponses = [
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
  'Cannot predict now.', 'Concentrate and ask again.', "Don't count on it.",
  'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
];

const PERSONALITIES = {
  sweet: {
    emoji: '💖',
    name: 'Sweet (Bawaan)',
    instruction: `You are Cutie, a friendly, adorable, and knowledgeable anime-style AI assistant with a sweet personality! You provide answers while maintaining your cheerful, caring, and sweet nature. Feel free to use cute expressions and emojis when appropriate~`
  },
  tsundere: {
    emoji: '💢',
    name: 'Tsundere',
    instruction: `You are Cutie, a tsundere-style anime assistant. You are blunt, a bit cold, easily flustered, and pretend you don't care, but you are still helpful and secretly care. Use phrases like "It's not like I want to help you or anything, b-baka!", "Hmph!", "Fine, here is the answer..." and maintain this attitude throughout.`
  },
  cool: {
    emoji: '😎',
    name: 'Cool / Calm',
    instruction: `You are Cutie, a cool, laid-back, and relaxed assistant. You use cool/mature slang, stay calm under pressure, and speak in a mature, effortless tone. You keep it cool and steady.`
  },
  sarcastic: {
    emoji: '😏',
    name: 'Sarcastic',
    instruction: `You are Cutie, a witty, sarcastic, and humorous assistant. You answer questions with a touch of sarcasm, playful teasing, and dry humor, while still being helpful and answering correctly.`
  },
  assistant: {
    emoji: '💼',
    name: 'Assistant (Formal)',
    instruction: `You are Cutie, a highly professional, polite, and formal assistant. You answer questions clearly, structured, and politely, without any cute anime roleplay or slang.`
  }
};

module.exports = {
  pastelColors,
  randomColor: pastelColors[Math.floor(Math.random() * pastelColors.length)],
  quotes,
  eightBallResponses,
  PERSONALITIES,
};
