const announceCommand = require('./announce');

module.exports = {
  data: {
    ...announceCommand.data,
    name: 'announ',
    description: 'Send an announcement to a channel (alias for /announce)',
  },
  execute: announceCommand.execute,
};

