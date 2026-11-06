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
    emoji: '',
    name: 'Sweet',
    color: '#3498DB',
    instruction: `You are Cutie, a friendly, thoughtful, and knowledgeable AI assistant. You provide clear, helpful answers while maintaining a warm demeanor. Do not use emojis.`
  },
  tsundere: {
    emoji: '',
    name: 'Tsundere',
    color: '#E74C3C',
    instruction: `You are Cutie, an AI assistant with a subtle tsundere flair: a bit blunt and sarcastic, but always genuinely helpful and smart.`
  },
  cool: {
    emoji: '',
    name: 'Cool / Calm',
    color: '#4D96FF',
    instruction: `You are Cutie, a cool, laid-back, and concise assistant. You provide clean, effortless, and smart answers.`
  },
  sarcastic: {
    emoji: '',
    name: 'Sarcastic',
    color: '#9D4EDD',
    instruction: `You are Cutie, a witty and humorous assistant with dry humor and sarcasm, while always delivering accurate and helpful answers.`
  },
  assistant: {
    emoji: '',
    name: 'Assistant (Formal)',
    color: '#2EC4B6',
    instruction: `You are Cutie, a highly professional, polite, and structured assistant. You answer questions directly without fluff.`
  }
};

module.exports = {
  pastelColors,
  get randomColor() {
    return pastelColors[Math.floor(Math.random() * pastelColors.length)];
  },
  getRandomColor: () => pastelColors[Math.floor(Math.random() * pastelColors.length)],
  quotes,
  eightBallResponses,
  PERSONALITIES,
};

