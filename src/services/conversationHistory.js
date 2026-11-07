const supabase = require('./supabaseClient');
const { chatCompletion } = require('./aiClient');

const MAX_HISTORY_MESSAGES = 50; // History capacity before compacting into 1 recap row
const memoryHistory = new Map(); // userId -> [{ role, content }]
const activeCompactions = new Map(); // userId -> Promise (in-flight compaction promise)

/**
 * Generates an intelligent, high-density recap of 50 conversation messages.
 * Uses chatCompletion with an Indonesian system prompt, and provides a safe fallback if the API fails.
 */
async function generateConversationRecap(messages) {
  const formatted = messages
    .map(m => `${m.role === 'user' ? 'Master/User' : 'Cutie/Assistant'}: ${m.content}`)
    .join('\n');

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah modul memori AI untuk Cutie. Buatlah ringkasan/rekap percakapan yang padat, jelas, dan terstruktur dari 50 pesan percakapan sebelumnya dalam bahasa Indonesia. Rekap harus mencatat: (1) Informasi pribadi atau preferensi Master yang disebutkan, (2) Topik-topik penting dan diskusi yang telah dibahas, (3) Janji, pengingat, atau tugas yang pernah dibicarakan. Format dalam 3-5 kalimat narasi atau poin penting ringkas.',
        },
        {
          role: 'user',
          content: `Berikut adalah riwayat percakapan yang harus direkap:\n\n${formatted.slice(0, 10000)}`,
        },
      ],
      maxTokens: 400,
      temperature: 0.3,
    });

    const recapContent = response?.content?.trim();
    if (recapContent) {
      return `[Rekap 50 percakapan sebelumnya]:\n${recapContent}`;
    }
  } catch (err) {
    console.error('[ChatHistory] Failed to generate AI recap, falling back:', err.message || err);
  }

  // Fallback summary if AI call fails
  const userSnippets = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.replace(/\n+/g, ' ').trim().slice(0, 70))
    .filter(Boolean)
    .slice(-6)
    .map(s => `• ${s}`)
    .join('\n');

  return `[Rekap 50 percakapan sebelumnya]:\nRingkasan topik penting yang dibahas bersama Master:\n${userSnippets || '• Percakapan santai seputar berbagai topik.'}`;
}

/**
 * Compacts history when row count reaches MAX_HISTORY_MESSAGES (50).
 * Summarizes the oldest 50 messages into 1 recap row, deletes the 50 old rows,
 * and preserves any newer messages both in Supabase and memory.
 */
async function compactHistoryIfNeeded(userId) {
  if (activeCompactions.has(userId)) {
    return await activeCompactions.get(userId);
  }

  const compactionPromise = (async () => {
    try {
      let rows = null;
      try {
        const { data, error } = await supabase
          .from('ai_conversations')
          .select('id, role, content, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          rows = data;
        }
      } catch (_) {
        // Supabase offline / unavailable
      }

      // 1. Supabase-backed compaction
      if (rows && rows.length >= MAX_HISTORY_MESSAGES) {
        const toCompact = rows.slice(0, MAX_HISTORY_MESSAGES);
        const summaryText = await generateConversationRecap(toCompact);

        // Insert the recap row
        const { error: insertErr } = await supabase
          .from('ai_conversations')
          .insert({
            user_id: userId,
            role: 'assistant',
            content: summaryText,
          });

        if (insertErr) {
          console.error('[ChatHistory] Error inserting recap row in Supabase:', insertErr);
        } else {
          // Delete the compacted rows
          const idsToDelete = toCompact.map(r => r.id);
          const { error: deleteErr } = await supabase
            .from('ai_conversations')
            .delete()
            .eq('user_id', userId)
            .in('id', idsToDelete);

          if (deleteErr) {
            console.error('[ChatHistory] Error deleting compacted rows in Supabase:', deleteErr);
          }
        }

        // Update in-memory history to match
        const currentMemory = memoryHistory.get(userId) || [];
        const remainingMemory = currentMemory.slice(toCompact.length);
        memoryHistory.set(userId, [
          { role: 'assistant', content: summaryText },
          ...remainingMemory,
        ]);

        console.log(`[ChatHistory] Successfully compacted ${toCompact.length} messages into 1 recap row for user ${userId}`);
        return;
      }

      // 2. Fallback in-memory compaction (if Supabase is offline or table is empty)
      const currentMemory = memoryHistory.get(userId) || [];
      if (currentMemory.length >= MAX_HISTORY_MESSAGES) {
        const toCompact = currentMemory.slice(0, MAX_HISTORY_MESSAGES);
        const summaryText = await generateConversationRecap(toCompact);
        const remaining = currentMemory.slice(MAX_HISTORY_MESSAGES);
        memoryHistory.set(userId, [
          { role: 'assistant', content: summaryText },
          ...remaining,
        ]);
        console.log(`[ChatHistory] (In-memory) Compacted ${toCompact.length} messages into 1 recap row for user ${userId}`);
      }
    } catch (err) {
      console.error(`[ChatHistory] Compaction failed for user ${userId}:`, err);
    } finally {
      activeCompactions.delete(userId);
    }
  })();

  activeCompactions.set(userId, compactionPromise);
  return await compactionPromise;
}

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

// Stores one turn (role: 'user' | 'assistant') and triggers compaction when 50 messages is reached.
async function pushHistory(userId, role, content) {
  // Update in-memory history
  const current = memoryHistory.get(userId) || [];
  current.push({ role, content });
  memoryHistory.set(userId, current);

  try {
    const { error: insertError } = await supabase
      .from('ai_conversations')
      .insert({ user_id: userId, role, content });

    if (insertError) {
      console.error('Error saving AI conversation message in Supabase:', insertError);
    }
  } catch (err) {
    // Supabase offline, memory history retained
  }

  // Trigger compaction if threshold reached
  if (current.length >= MAX_HISTORY_MESSAGES) {
    compactHistoryIfNeeded(userId).catch(err => {
      console.error('[ChatHistory] Background compaction trigger error:', err);
    });
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

module.exports = {
  getHistory,
  pushHistory,
  clearHistory,
  compactHistoryIfNeeded,
  generateConversationRecap,
  MAX_HISTORY_MESSAGES,
};
