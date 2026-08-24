const supabase = require('./supabaseClient');

async function getGuildSettings(guildId) {
  try {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {};
      }
      console.error('Error fetching guild settings:', error);
      return {};
    }

    return data || {};
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

    console.log('Settings updated successfully:', data);
    return true;
  } catch (err) {
    console.error('Exception in updateGuildSettings:', err);
    return false;
  }
}

module.exports = { getGuildSettings, updateGuildSettings };
