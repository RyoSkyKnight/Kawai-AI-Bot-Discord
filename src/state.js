// Shared in-memory bot state (singleton via CommonJS module cache).
module.exports = {
  isProcessing: false,
  startTime: Date.now(),
  afkUsers: new Map(),
  spamTracking: new Map(),
  activeAskUsers: new Set(), // per-user lock for /ask, instead of one global lock
};
