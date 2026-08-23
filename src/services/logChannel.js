const { getGuildSettings } = require('./guildSettings');

async function sendLog(guild, embed) {
  try {
    const settings = await getGuildSettings(guild.id);
    if (settings.log_channel) {
      const channel = guild.channels.cache.get(settings.log_channel);
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

module.exports = { sendLog };
