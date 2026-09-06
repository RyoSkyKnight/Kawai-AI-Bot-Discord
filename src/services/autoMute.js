const supabase = require('./supabaseClient');
const cache = require('./cache');

const AUTO_MUTE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAutoMuteSettings(guildId) {
  const cacheKey = `automute_settings_${guildId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from('auto_mute_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching auto-mute settings:', error);
      return null;
    }

    const settings = data || null;
    cache.set(cacheKey, settings, AUTO_MUTE_TTL);
    return settings;
  } catch (err) {
    console.error('Exception in getAutoMuteSettings:', err);
    return null;
  }
}

async function updateAutoMuteSettings(guildId, settings) {
  try {
    const { data, error } = await supabase
      .from('auto_mute_settings')
      .upsert({
        guild_id: guildId,
        ...settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guild_id'
      })
      .select();

    if (error) {
      console.error('Error updating auto-mute settings:', error);
      return false;
    }

    // Invalidate cache immediately
    cache.del(`automute_settings_${guildId}`);

    return true;
  } catch (err) {
    console.error('Exception in updateAutoMuteSettings:', err);
    return false;
  }
}

module.exports = { getAutoMuteSettings, updateAutoMuteSettings };

