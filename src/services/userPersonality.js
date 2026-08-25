const supabase = require('./supabaseClient');

// Retrieve a user's stored personality (if any)
async function getUserPersonality(userId) {
  try {
    const { data, error } = await supabase
      .from('user_personality')
      .select('personality')
      .eq('user_id', userId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      console.error('Error fetching user personality:', error);
      return null;
    }
    return data?.personality || null;
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
    return true;
  } catch (err) {
    console.error('Exception in setUserPersonality:', err);
    return false;
  }
}

module.exports = { getUserPersonality, setUserPersonality };
