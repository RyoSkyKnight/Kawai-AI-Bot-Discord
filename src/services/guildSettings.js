const fs = require('fs');
const path = require('path');
const supabase = require('./supabaseClient');
const cache = require('./cache');

const GUILD_SETTINGS_TTL = 10 * 60 * 1000; // 10 minutes
const LOCAL_SETTINGS_FILE = path.resolve(__dirname, '../../guild_settings_local.json');

function getLocalSettings(guildId) {
  try {
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      const all = JSON.parse(fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf8'));
      return all[guildId] || {};
    }
  } catch (e) {
    console.error('Error reading local guild settings:', e.message);
  }
  return {};
}

function saveLocalSettings(guildId, settings) {
  try {
    let all = {};
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      all = JSON.parse(fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf8'));
    }
    all[guildId] = { ...(all[guildId] || {}), ...settings };
    fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local guild settings:', e.message);
  }
}

async function getGuildSettings(guildId) {
  const cacheKey = `guild_settings_${guildId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (!error && data) {
      cache.set(cacheKey, data, GUILD_SETTINGS_TTL);
      saveLocalSettings(guildId, data);
      return data;
    }
  } catch (err) {
    // Supabase unavailable or network error
  }

  // 2. Fallback to local storage
  const local = getLocalSettings(guildId);
  cache.set(cacheKey, local, GUILD_SETTINGS_TTL);
  return local;
}

async function updateGuildSettings(guildId, settings) {
  const cacheKey = `guild_settings_${guildId}`;

  // 1. Always update local storage and in-memory cache first
  const current = cache.get(cacheKey) || getLocalSettings(guildId);
  const updated = { ...current, ...settings, guild_id: guildId };
  cache.set(cacheKey, updated, GUILD_SETTINGS_TTL);
  saveLocalSettings(guildId, settings);

  // 2. Try persisting to Supabase in background
  try {
    const dataToUpsert = {
      guild_id: guildId,
      ...settings,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('guild_settings')
      .upsert(dataToUpsert, { onConflict: 'guild_id' })
      .select();

    if (error) {
      console.warn('Note: Supabase update skipped (using local storage):', error.message || error);
    } else {
      console.log('Settings synced to Supabase:', data);
    }
  } catch (err) {
    console.warn('Note: Supabase unavailable (using local storage):', err.message);
  }

  return true;
}

module.exports = { getGuildSettings, updateGuildSettings };
