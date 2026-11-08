const supabase = require('./supabaseClient');
const { chatCompletion } = require('./aiClient');

const MAX_HISTORY_MESSAGES = 50; // History capacity before compacting into 1 recap row
const memoryHistory = new Map(); // userId -> [{ role, content }]
const activeCompactions = new Map(); // userId -> Promise (in-flight compaction promise)

/**
 * Combines all chat messages directly into a single formatted transcript block.
 * Executed when AI summarization fails 2-3 times ("copas dijadiin 1").
 */
function combineAllChatsIntoOne(messages) {
  const formattedLines = messages
    .filter(m => m.content && !isCorruptedContent(m.content))
    .map(m => {
      const sender = m.role === 'user' ? 'Master' : 'Cutie';
      const text = m.content.replace(/\r?\n+/g, ' ').trim();
      return `${sender}: "${text.slice(0, 250)}"`;
    });

  if (formattedLines.length === 0) {
    return `[Archive of previous 50 messages]:\nCasual conversation on various topics with Master.`;
  }

  return `[Archive of previous 50 messages]:\n${formattedLines.join('\n')}`;
}

/**
 * Generates an intelligent recap of 50 conversation messages.
 * Tries AI summarization up to 2 times. If it fails or returns invalid text,
 * immediately combines (copas) all 50 messages into 1 single archive row.
 */
async function generateConversationRecap(messages) {
  const formatted = messages
    .filter(m => m.content && !isCorruptedContent(m.content))
    .map(m => `${m.role === 'user' ? 'Master/User' : 'Cutie/Assistant'}: ${m.content}`)
    .join('\n');

  const MAX_AI_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      const response = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an AI memory module for Cutie. Create a dense, clear, and structured summary of the previous 50 messages. Note: (1) Personal information or user preferences mentioned, (2) Key topics and discussions, (3) Promises, reminders, or tasks discussed. Keep it within 3-5 concise narrative sentences or key bullet points.',
          },
          {
            role: 'user',
            content: `Here is the conversation history to summarize:\n\n${formatted.slice(0, 10000)}`,
          },
        ],
        maxTokens: 800,
        temperature: 0.3,
      });

      const recapContent = response?.content?.trim();
      const isInvalid = !recapContent ||
        recapContent.length < 25 ||
        recapContent.toLowerCase().includes("couldn't generate a response") ||
        recapContent.toLowerCase().includes("i'm sorry") ||
        recapContent.toLowerCase().includes("please try again") ||
        recapContent.toLowerCase().includes("placeholder") ||
        recapContent.toLowerCase().includes("no content");

      if (!isInvalid) {
        return `[Archive of previous 50 messages]:\n${recapContent}`;
      }
      console.warn(`[ChatHistory] AI recap attempt ${attempt} returned invalid content, retrying...`);
    } catch (err) {
      console.warn(`[ChatHistory] AI recap attempt ${attempt} failed (${err.message}), retrying...`);
    }
  }

  // Fallback: combine all 50 chats into 1 archive row
  console.log('[ChatHistory] AI recap failed after retries. Combining all 50 chats into 1 archive row.');
  return combineAllChatsIntoOne(messages);
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

/**
 * Returns the last N messages for a user, oldest first, in
 * { role, content } shape ready to spread into an OpenRouter messages array.
 * Automatically cleanses any corrupted error messages from history.
 */
async function getHistory(userId) {
  try {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    if (error) {
      console.error('Error fetching AI conversation history:', error);
      const mem = memoryHistory.get(userId) || [];
      return mem.filter(m => !isCorruptedContent(m.content));
    }

    const corruptedIds = [];
    const validRows = [];

    for (const row of (data || [])) {
      if (isCorruptedContent(row.content)) {
        if (row.id) corruptedIds.push(row.id);
      } else {
        validRows.push({ role: row.role, content: row.content });
      }
    }

    // Asynchronously delete corrupted rows from Supabase
    if (corruptedIds.length > 0) {
      supabase
        .from('ai_conversations')
        .delete()
        .eq('user_id', userId)
        .in('id', corruptedIds)
        .then(() => {
          console.log(`[ChatHistory] Sanitized ${corruptedIds.length} corrupted rows from Supabase for user ${userId}`);
        })
        .catch(() => {});
    }

    const rows = validRows.reverse(); // put back in chronological order

    if (rows.length > 0) {
      memoryHistory.set(userId, rows);
      return rows;
    }

    const mem = memoryHistory.get(userId) || [];
    return mem.filter(m => !isCorruptedContent(m.content));
  } catch (err) {
    const mem = memoryHistory.get(userId) || [];
    return mem.filter(m => !isCorruptedContent(m.content));
  }
}

function isCorruptedContent(content) {
  if (typeof content !== 'string') return false;
  const lower = content.toLowerCase();
  return lower.includes("couldn't generate a response") ||
    lower.includes("please try again later") ||
    lower.includes("terjadi kesalahan saat memproses") ||
    lower.includes("maafkan aku, sepertinya aku sedikit bingung") ||
    lower.includes("we need answer user") ||
    lower.includes("we need parse") ||
    lower.includes("let's draft") ||
    lower.includes("komputermata") ||
    lower.includes("<think>") ||
    lower.includes("</think>") ||
    lower.includes("in-character remark and signature kaomoji") ||
    lower.includes("check guidelines") ||
    lower.includes("we are cutie maid assistant") ||
    ((lower.startsWith("[rekap") || lower.startsWith("[archive") || lower.startsWith("[summary")) && (lower.includes("i'm sorry") || lower.includes("maaf")));
}

// Stores one turn (role: 'user' | 'assistant') and triggers compaction when 50 messages is reached.
async function pushHistory(userId, role, content) {
  if (isCorruptedContent(content)) {
    return; // Never save corrupted error strings into history
  }

  // Update in-memory history
  const current = (memoryHistory.get(userId) || []).filter(m => !isCorruptedContent(m.content));
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
  combineAllChatsIntoOne,
  isCorruptedContent,
  MAX_HISTORY_MESSAGES,
};
