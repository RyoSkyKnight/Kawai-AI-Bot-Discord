const supabase = require('./supabaseClient');

async function getAutoMuteSettings(guildId) {
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

    return data;
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

    return true;
  } catch (err) {
    console.error('Exception in updateAutoMuteSettings:', err);
    return false;
  }
}

module.exports = { getAutoMuteSettings, updateAutoMuteSettings };
