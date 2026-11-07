const supabase = require('./supabaseClient');
const cache = require('./cache');

const USER_PERS_TTL = 30 * 60 * 1000; // 30 minutes
const memoryPersonalities = new Map(); // In-memory fallback map: userId -> personality

// Retrieve a user's stored personality (if any)
async function getUserPersonality(userId) {
  if (memoryPersonalities.has(userId)) {
    return memoryPersonalities.get(userId);
  }

  const cacheKey = `user_pers_${userId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    if (cached) memoryPersonalities.set(userId, cached);
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from('user_personality')
      .select('personality')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        cache.set(cacheKey, null, USER_PERS_TTL);
        return null; // not found
      }
      return memoryPersonalities.get(userId) || null;
    }

    const personality = data?.personality || null;
    if (personality) {
      memoryPersonalities.set(userId, personality);
      cache.set(cacheKey, personality, USER_PERS_TTL);
    }
    return personality;
  } catch (err) {
    return memoryPersonalities.get(userId) || null;
  }
}

// Upsert a user's personality
async function setUserPersonality(userId, personality) {
  memoryPersonalities.set(userId, personality);
  const cacheKey = `user_pers_${userId}`;
  cache.set(cacheKey, personality, USER_PERS_TTL);

  try {
    const { data, error } = await supabase
      .from('user_personality')
      .upsert({ user_id: userId, personality }, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.error('Error setting user personality in Supabase:', error.message || error);
      return true;
    }
    return true;
  } catch (err) {
    // Supabase offline, memory and cache retained
    return true;
  }
}

module.exports = { getUserPersonality, setUserPersonality };
