const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID || process.env.APPLICATION_ID || process.env.APP_ID,
  API_KEY: process.env.API_KEY || process.env.OPENROUTER_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || process.env.API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  USE_SHORT_RESPONSE: process.env.USE_SHORT_RESPONSE === 'true',
  CREATOR_ID: process.env.CREATOR_ID,
  TENOR_API_KEY: process.env.TENOR_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
};
