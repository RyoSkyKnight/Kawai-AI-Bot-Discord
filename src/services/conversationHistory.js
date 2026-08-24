const supabase = require('./supabaseClient');

const MAX_HISTORY_MESSAGES = 50; // ~5 user/assistant exchanges kept per user

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
      return [];
    }

    return (data || [])
      .slice()
      .reverse() // we fetched newest-first, put back in chronological order
      .map((row) => ({ role: row.role, content: row.content }));
  } catch (err) {
    console.error('Exception in getHistory:', err);
    return [];
  }
}

// Stores one turn (role: 'user' | 'assistant') and trims old rows so the
// table doesn't grow unbounded per user.
async function pushHistory(userId, role, content) {
  try {
    const { error: insertError } = await supabase
      .from('ai_conversations')
      .insert({ user_id: userId, role, content });

    if (insertError) {
      console.error('Error saving AI conversation message:', insertError);
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

    if (deleteError) console.error('Error trimming AI conversation history:', deleteError);
  } catch (err) {
    console.error('Exception in pushHistory:', err);
  }
}

async function clearHistory(userId) {
  try {
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', userId);

    if (error) console.error('Error clearing AI conversation history:', error);
  } catch (err) {
    console.error('Exception in clearHistory:', err);
  }
}

module.exports = { getHistory, pushHistory, clearHistory };
