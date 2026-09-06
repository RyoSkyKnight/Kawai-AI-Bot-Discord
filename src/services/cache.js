/**
 * Simple in-memory TTL (Time-To-Live) cache to reduce database calls to Supabase.
 */

class Cache {
  constructor(defaultTtlMs = 3 * 60 * 1000) {
    this.store = new Map();
    this.defaultTtl = defaultTtlMs;

    // Periodic sweep every 5 minutes to prevent memory leak
    const timer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    if (timer.unref) timer.unref(); // don't hold process open in tests
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtl) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  del(key) {
    return this.store.delete(key);
  }

  flush() {
    this.store.clear();
  }

  sweep() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

const defaultCache = new Cache();

module.exports = defaultCache;
module.exports.Cache = Cache;
