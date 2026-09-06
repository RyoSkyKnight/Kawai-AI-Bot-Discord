const supabase = require('./supabaseClient');
const cache = require('./cache');

const GUILD_SETTINGS_TTL = 5 * 60 * 1000; // 5 minutes

async function getGuildSettings(guildId) {
  const cacheKey = `guild_settings_${guildId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        cache.set(cacheKey, {}, GUILD_SETTINGS_TTL);
        return {};
      }
      console.error('Error fetching guild settings:', error);
      return {};
    }

    const settings = data || {};
    cache.set(cacheKey, settings, GUILD_SETTINGS_TTL);
    return settings;
  } catch (err) {
    console.error('Exception in getGuildSettings:', err);
    return {};
  }
}

async function updateGuildSettings(guildId, settings) {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing settings:', fetchError);
    }

    const dataToUpsert = {
      guild_id: guildId,
      ...settings,
      updated_at: new Date().toISOString()
    };

    if (!existing) {
      dataToUpsert.created_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('guild_settings')
      .upsert(dataToUpsert, {
        onConflict: 'guild_id'
      })
      .select();

    if (error) {
      console.error('Error updating guild settings:', error);
      return false;
    }

    // Invalidate cache immediately
    cache.del(`guild_settings_${guildId}`);

    console.log('Settings updated successfully:', data);
    return true;
  } catch (err) {
    console.error('Exception in updateGuildSettings:', err);
    return false;
  }
}

module.exports = { getGuildSettings, updateGuildSettings };

