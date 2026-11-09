const fs = require('fs');
const path = require('path');

const REMINDERS_FILE = path.resolve(__dirname, '../../reminders_local.json');
const activeTimers = new Map(); // id -> setTimeout handle

function loadRemindersFromDisk() {
  try {
    if (fs.existsSync(REMINDERS_FILE)) {
      const data = fs.readFileSync(REMINDERS_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error loading reminders from disk:', err.message);
  }
  return [];
}

function saveRemindersToDisk(reminders) {
  try {
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving reminders to disk:', err.message);
  }
}

async function deliverReminder(reminder, client, isAfterRestart = false) {
  const { id, userId, channelId, timeStr, message } = reminder;

  // Clean from active timers
  if (activeTimers.has(id)) {
    activeTimers.delete(id);
  }

  // Remove from persistent storage
  removeReminderFromStorage(id);

  console.log(`[Timer] Delivering reminder ${id} to user ${userId}: "${message}"`);
  const alertContent = `⏰ <@${userId}> **Ding-dong! Reminder from Cutie for Master (${timeStr})** 💕\n> "${message}"\n*(◕‿◕)♡ Don't forget, Master!*${isAfterRestart ? ' *(Delivered upon bot restart)*' : ''}`;

  let sent = false;

  // 1. Try channel
  if (client && channelId) {
    try {
      const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
      if (channel && typeof channel.send === 'function') {
        await channel.send({ content: alertContent });
        sent = true;
      }
    } catch (err) {
      console.warn(`[Timer] Failed to deliver to channel ${channelId}:`, err.message);
    }
  }

  // 2. Fallback to DM if channel failed
  if (!sent && client && userId) {
    try {
      const user = client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
      if (user && typeof user.send === 'function') {
        await user.send({ content: alertContent });
        sent = true;
      }
    } catch (err) {
      console.warn(`[Timer] Failed to deliver to user DM ${userId}:`, err.message);
    }
  }

  if (!sent) {
    console.error(`[Timer] CRITICAL: Could not deliver reminder ${id} to channel or DM.`);
  }
}

function removeReminderFromStorage(id) {
  const list = loadRemindersFromDisk().filter(r => r.id !== id);
  saveRemindersToDisk(list);
}

function addReminder({ id, userId, channelId, targetTimestamp, timeStr, message }, client) {
  const reminderId = id || `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reminder = {
    id: reminderId,
    userId,
    channelId,
    targetTimestamp,
    timeStr,
    message,
    createdAt: Date.now(),
  };

  // 1. Persist to storage
  const list = loadRemindersFromDisk();
  list.push(reminder);
  saveRemindersToDisk(list);

  // 2. Schedule timeout
  const delayMs = Math.max(0, targetTimestamp - Date.now());
  const timer = setTimeout(() => {
    deliverReminder(reminder, client, false);
  }, delayMs).unref();

  activeTimers.set(reminderId, timer);
  return reminder;
}

function cancelReminder(id) {
  if (activeTimers.has(id)) {
    clearTimeout(activeTimers.get(id));
    activeTimers.delete(id);
  }
  removeReminderFromStorage(id);
}

function initReminders(client) {
  const list = loadRemindersFromDisk();
  if (list.length === 0) return;

  console.log(`[Timer] Restoring ${list.length} scheduled reminder(s) from persistent storage...`);
  const now = Date.now();

  list.forEach(reminder => {
    const remainingMs = reminder.targetTimestamp - now;
    if (remainingMs <= 0) {
      // Overdue while offline, deliver shortly after ready
      setTimeout(() => {
        deliverReminder(reminder, client, true);
      }, 5000).unref();
    } else {
      const timer = setTimeout(() => {
        deliverReminder(reminder, client, false);
      }, remainingMs).unref();
      activeTimers.set(reminder.id, timer);
    }
  });
}

function getPendingReminders(userId) {
  const list = loadRemindersFromDisk();
  if (!userId) return list;
  return list.filter(r => r.userId === userId);
}

module.exports = {
  addReminder,
  removeReminderFromStorage,
  cancelReminder,
  initReminders,
  getPendingReminders,
};
