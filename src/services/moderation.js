const supabase = require('./supabaseClient');

// In-memory fallbacks when Supabase is unreachable
const memoryWarnings = new Map(); // `${guildId}_${userId}` -> []
const memoryModLogs = new Map(); // guildId -> []

async function addWarning(guildId, userId, reason, moderatorId) {
  const record = {
    guild_id: guildId,
    user_id: userId,
    reason,
    moderator_id: moderatorId,
    created_at: new Date().toISOString()
  };

  const key = `${guildId}_${userId}`;
  if (!memoryWarnings.has(key)) memoryWarnings.set(key, []);
  memoryWarnings.get(key).unshift(record);

  try {
    const { error } = await supabase
      .from('warnings')
      .insert(record);

    if (error) console.error('Error adding warning in Supabase:', error.message || error);
  } catch (err) {
    // Supabase offline, memory fallback retained
  }
}

async function getWarnings(guildId, userId) {
  const key = `${guildId}_${userId}`;
  try {
    const { data, error } = await supabase
      .from('warnings')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching warnings from Supabase:', error.message || error);
      return memoryWarnings.get(key) || [];
    }

    if (data && data.length > 0) {
      memoryWarnings.set(key, data);
      return data;
    }
    return memoryWarnings.get(key) || [];
  } catch (err) {
    return memoryWarnings.get(key) || [];
  }
}

async function clearWarnings(guildId, userId) {
  const key = `${guildId}_${userId}`;
  memoryWarnings.delete(key);

  try {
    const { error } = await supabase
      .from('warnings')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    if (error) console.error('Error clearing warnings in Supabase:', error.message || error);
  } catch (err) {
    // Supabase offline, memory cleared
  }
}

async function logModAction(guildId, action, moderatorId, targetId, reason) {
  const record = {
    guild_id: guildId,
    action,
    moderator_id: moderatorId,
    target_id: targetId,
    reason,
    created_at: new Date().toISOString()
  };

  if (!memoryModLogs.has(guildId)) memoryModLogs.set(guildId, []);
  memoryModLogs.get(guildId).unshift(record);

  try {
    const { error } = await supabase
      .from('mod_logs')
      .insert(record);

    if (error) console.error('Error logging mod action in Supabase:', error.message || error);
  } catch (err) {
    // Supabase offline, memory fallback retained
  }
}

async function getModStats(guildId) {
  try {
    const { data, error } = await supabase
      .from('mod_logs')
      .select('action, moderator_id')
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error fetching mod stats from Supabase:', error.message || error);
      return memoryModLogs.get(guildId) || [];
    }
    return (data && data.length > 0) ? data : (memoryModLogs.get(guildId) || []);
  } catch (err) {
    return memoryModLogs.get(guildId) || [];
  }
}

module.exports = { addWarning, getWarnings, clearWarnings, logModAction, getModStats };
