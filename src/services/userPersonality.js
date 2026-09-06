const supabase = require('./supabaseClient');
const cache = require('./cache');

const USER_PERS_TTL = 10 * 60 * 1000; // 10 minutes

// Retrieve a user's stored personality (if any)
async function getUserPersonality(userId) {
  const cacheKey = `user_pers_${userId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
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
      console.error('Error fetching user personality:', error);
      return null;
    }
    const personality = data?.personality || null;
    cache.set(cacheKey, personality, USER_PERS_TTL);
    return personality;
  } catch (err) {
    console.error('Exception in getUserPersonality:', err);
    return null;
  }
}

// Upsert a user's personality
async function setUserPersonality(userId, personality) {
  try {
    const { data, error } = await supabase
      .from('user_personality')
      .upsert({ user_id: userId, personality }, { onConflict: 'user_id' })
      .select();
    if (error) {
      console.error('Error setting user personality:', error);
      return false;
    }
    // Invalidate cache
    cache.del(`user_pers_${userId}`);
    return true;
  } catch (err) {
    console.error('Exception in setUserPersonality:', err);
    return false;
  }
}

module.exports = { getUserPersonality, setUserPersonality };

