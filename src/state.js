// Shared in-memory bot state (singleton via CommonJS module cache).
module.exports = {
  isProcessing: false,
  startTime: Date.now(),
  afkUsers: new Map(),
  spamTracking: new Map(),
};
