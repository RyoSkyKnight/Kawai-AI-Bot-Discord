const { getGuildSettings } = require('./guildSettings');

async function sendLog(guild, embed, components = []) {
  if (!guild) return;
  try {
    const settings = await getGuildSettings(guild.id);
    if (settings && settings.log_channel) {
      const channel = guild.channels.cache.get(settings.log_channel) || await guild.channels.fetch(settings.log_channel).catch(() => null);
      if (channel && typeof channel.send === 'function') {
        const payload = { embeds: [embed] };
        if (Array.isArray(components) && components.length > 0) {
          payload.components = components;
        }
        await channel.send(payload);
      }
    }
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

module.exports = { sendLog };
