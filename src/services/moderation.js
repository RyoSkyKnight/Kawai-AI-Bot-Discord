const supabase = require('./supabaseClient');

async function addWarning(guildId, userId, reason, moderatorId) {
  const { error } = await supabase
    .from('warnings')
    .insert({
      guild_id: guildId,
      user_id: userId,
      reason: reason,
      moderator_id: moderatorId,
      created_at: new Date()
    });

  if (error) console.error('Error adding warning:', error);
}

async function getWarnings(guildId, userId) {
  const { data, error } = await supabase
    .from('warnings')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) console.error('Error fetching warnings:', error);
  return data || [];
}

async function clearWarnings(guildId, userId) {
  const { error } = await supabase
    .from('warnings')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (error) console.error('Error clearing warnings:', error);
}

async function logModAction(guildId, action, moderatorId, targetId, reason) {
  const { error } = await supabase
    .from('mod_logs')
    .insert({
      guild_id: guildId,
      action: action,
      moderator_id: moderatorId,
      target_id: targetId,
      reason: reason,
      created_at: new Date()
    });

  if (error) console.error('Error logging mod action:', error);
}

async function getModStats(guildId) {
  const { data, error } = await supabase
    .from('mod_logs')
    .select('action, moderator_id')
    .eq('guild_id', guildId);

  if (error) console.error('Error fetching mod stats:', error);
  return data || [];
}

module.exports = { addWarning, getWarnings, clearWarnings, logModAction, getModStats };
