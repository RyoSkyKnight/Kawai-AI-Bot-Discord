const supabase = require('./supabaseClient');

const MAX_HISTORY_MESSAGES = 12; // ~6 user/assistant exchanges kept per user
const memoryHistory = new Map(); // userId -> [{ role, content }]

// Returns the last N messages for a user, oldest first, in
// { role, content } shape ready to spread into an OpenRouter messages array.
async function getHistory(userId) {
  try {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    if (error) {
      console.error('Error fetching AI conversation history:', error);
      return memoryHistory.get(userId) || [];
    }

    const rows = (data || [])
      .slice()
      .reverse() // fetched newest-first, put back in chronological order
      .map((row) => ({ role: row.role, content: row.content }));

    if (rows.length > 0) {
      memoryHistory.set(userId, rows);
      return rows;
    }

    return memoryHistory.get(userId) || [];
  } catch (err) {
    return memoryHistory.get(userId) || [];
  }
}

// Stores one turn (role: 'user' | 'assistant') and trims old rows so the
// table doesn't grow unbounded per user.
async function pushHistory(userId, role, content) {
  // Update in-memory history
  const current = memoryHistory.get(userId) || [];
  current.push({ role, content });
  if (current.length > MAX_HISTORY_MESSAGES) {
    current.splice(0, current.length - MAX_HISTORY_MESSAGES);
  }
  memoryHistory.set(userId, current);

  try {
    const { error: insertError } = await supabase
      .from('ai_conversations')
      .insert({ user_id: userId, role, content });

    if (insertError) {
      console.error('Error saving AI conversation message in Supabase:', insertError);
      return;
    }

    // Trim anything beyond the most recent MAX_HISTORY_MESSAGES for this user.
    const { data: idsToKeep, error: selectError } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    if (selectError || !idsToKeep || idsToKeep.length < MAX_HISTORY_MESSAGES) return;

    const keepIds = idsToKeep.map((r) => r.id);
    const { error: deleteError } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${keepIds.join(',')})`);

    if (deleteError) console.error('Error trimming AI conversation history in Supabase:', deleteError);
  } catch (err) {
    // Supabase offline, memory history retained
  }
}

async function clearHistory(userId) {
  memoryHistory.delete(userId);
  try {
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', userId);

    if (error) console.error('Error clearing AI conversation history in Supabase:', error);
  } catch (err) {
    // Supabase offline, memory cleared
  }
}

module.exports = { getHistory, pushHistory, clearHistory };
