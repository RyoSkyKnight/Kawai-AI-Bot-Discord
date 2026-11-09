const clearHistoryCommand = require('./clearhistory');

module.exports = {
  data: {
    name: 'reset',
    description: 'Reset / clear your AI conversation memory with Cutie (alias for /clearhistory)',
  },
  execute: clearHistoryCommand.execute,
};

