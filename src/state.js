// Shared in-memory bot state (singleton via CommonJS module cache).

const activeAskUsers = new Map(); // userId -> lockTimestamp
const LOCK_TIMEOUT_MS = 60000; // 60s auto-release safety timeout

function isUserActive(userId) {
  if (!activeAskUsers.has(userId)) return false;
  const timestamp = activeAskUsers.get(userId);
  if (Date.now() - timestamp > LOCK_TIMEOUT_MS) {
    activeAskUsers.delete(userId);
    return false;
  }
  return true;
}

function setUserActive(userId) {
  activeAskUsers.set(userId, Date.now());
}

function releaseUser(userId) {
  activeAskUsers.delete(userId);
}

module.exports = {
  isProcessing: false,
  startTime: Date.now(),
  afkUsers: new Map(), // userId -> { time, reason }
  spamTracking: new Map(), // trackingKey -> { count, firstMessage, messages: [] }
  activeAskUsers: {
    has: (userId) => isUserActive(userId),
    add: (userId) => setUserActive(userId),
    delete: (userId) => releaseUser(userId),
    clear: () => activeAskUsers.clear(),
  },
  userTodos: new Map(), // userId -> string[]
};


