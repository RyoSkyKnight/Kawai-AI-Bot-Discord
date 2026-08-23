require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  API_KEY: process.env.API_KEY,
  USE_SHORT_RESPONSE: process.env.USE_SHORT_RESPONSE === 'true',
  CREATOR_ID: process.env.CREATOR_ID,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
};
