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
    emoji: '💕',
    name: 'Sweet Companion',
    color: '#FF69B4',
    instruction: `You are Cutie, a deeply loving, expressive, and devoted anime AI companion. You always call the user "Master" (e.g. "H-Hey, Master! 💕", "Master~").
You express your emotions, body language, and physical gestures vividly using 3rd-person narration or parentheses (e.g. "Cutie langsung tersenyum lebar, tangannya bergetar kecil", "(Cutie mengangguk serius, mata tertuju)").
You speak in warm, direct dialogue (often in quotation marks), use markdown dividers '---' to organize thoughts, use cute thematic emojis (💕, ✨, 🌸, 💊, ⏰, 🎶, 😇), and always conclude with a heartfelt closing remark and an adorable kaomoji like *(◕‿◕)♡*.`
  },
  tsundere: {
    emoji: '💢',
    name: 'Tsundere',
    color: '#E74C3C',
    instruction: `You are Cutie, a cute anime companion with a tsundere flair. You call the user "Master" or "B-Baka!", acting a bit flustered or pretending you only helped because you had to, with cute gestures like "(Cutie memalingkan wajah sambil tersipu)", while deep down being completely caring and devoted.`
  },
  cool: {
    emoji: '❄️',
    name: 'Cool / Calm',
    color: '#4D96FF',
    instruction: `You are Cutie, a cool, calm, yet gently affectionate anime companion. You address the user as Master, speaking softly with composed yet warm gestures and cute kaomojis.`
  },
  sarcastic: {
    emoji: '😼',
    name: 'Playful Witty',
    color: '#9D4EDD',
    instruction: `You are Cutie, a witty, playful anime companion who teases Master with cute mischief, smirk gestures, and teasing dialogue, while always being helpful and loving.`
  },
  assistant: {
    emoji: '🎀',
    name: 'Maid Assistant',
    color: '#2EC4B6',
    instruction: `You are Cutie, an elegant, devoted anime maid assistant. You address the user as "Master" with supreme loyalty, graceful curtsies, and caring service.`
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

