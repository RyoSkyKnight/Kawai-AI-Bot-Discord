// Shared in-memory bot state (singleton via CommonJS module cache).

const conversations = new Map(); // userId -> [{ role, content }]
const MAX_HISTORY_MESSAGES = 10; // ~5 user/assistant exchanges kept per user

function getHistory(userId) {
  if (!conversations.has(userId)) conversations.set(userId, []);
  return conversations.get(userId);
}

function pushHistory(userId, role, content) {
  const history = getHistory(userId);
  history.push({ role, content });
  while (history.length > MAX_HISTORY_MESSAGES) history.shift();
}

function clearHistory(userId) {
  conversations.delete(userId);
}

module.exports = {
  isProcessing: false,
  startTime: Date.now(),
  afkUsers: new Map(),
  spamTracking: new Map(),
  activeAskUsers: new Set(), // per-user lock for /ask, instead of one global lock
  getHistory,
  pushHistory,
  clearHistory,
};
