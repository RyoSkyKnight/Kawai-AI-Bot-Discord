const supabase = require('./supabaseClient');

async function getBadWords(guildId) {
  try {
    const { data, error } = await supabase
      .from('bad_words')
      .select('*')
      .eq('guild_id', guildId)
      .order('word', { ascending: true });

    if (error) {
      console.error('Error fetching bad words:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception in getBadWords:', err);
    return [];
  }
}

async function addBadWord(guildId, word, addedBy) {
  try {
    const { data, error } = await supabase
      .from('bad_words')
      .insert({
        guild_id: guildId,
        word: word.toLowerCase(),
        added_by: addedBy
      })
      .select();

    if (error) {
      if (error.code === '23505') { // Duplicate key
        return { success: false, error: 'Word already exists' };
      }
      console.error('Error adding bad word:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Exception in addBadWord:', err);
    return { success: false, error: err.message };
  }
}

async function removeBadWord(guildId, word) {
  try {
    const { data, error } = await supabase
      .from('bad_words')
      .delete()
      .eq('guild_id', guildId)
      .eq('word', word.toLowerCase())
      .select();

    if (error) {
      console.error('Error removing bad word:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (err) {
    console.error('Exception in removeBadWord:', err);
    return false;
  }
}

function containsBadWords(message, badWords) {
  const lowerMessage = message.toLowerCase();
  return badWords.some(bw => {
    const word = bw.word.toLowerCase();
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerMessage);
  });
}

module.exports = { getBadWords, addBadWord, removeBadWord, containsBadWords };
