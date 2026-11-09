const { ActivityType } = require('discord.js');
const { initReminders } = require('../services/reminderManager');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`👥 Watching ${client.users.cache.size} users`);

    // 1. Restore all pending & overdue persistent reminders
    try {
      initReminders(client);
    } catch (err) {
      console.error('Error initializing persistent reminders:', err);
    }

    // 2. Dynamic Rotating Activity Presence
    const activities = [
      () => ({
        name: 'Serving Master with love 💕 | /help',
        type: ActivityType.Custom,
      }),
      () => ({
        name: `over ${client.guilds.cache.size} servers & ${client.users.cache.size} members 🌸`,
        type: ActivityType.Watching,
      }),
      () => ({
        name: 'Mention me or /ask to chat! (◕‿◕)♡',
        type: ActivityType.Custom,
      }),
      () => ({
        name: 'Cutie Maid Assistant ready! ✨',
        type: ActivityType.Playing,
      }),
    ];

    let currentIdx = 0;
    const updatePresence = () => {
      try {
        const activityFactory = activities[currentIdx];
        const activity = activityFactory();
        client.user.setPresence({
          activities: [activity],
          status: 'online',
        });
        currentIdx = (currentIdx + 1) % activities.length;
      } catch (err) {
        console.error('Error updating presence:', err.message);
      }
    };

    // Initial presence set
    updatePresence();

    // Rotate every 30 seconds
    setInterval(updatePresence, 30 * 1000).unref();
  },
};
