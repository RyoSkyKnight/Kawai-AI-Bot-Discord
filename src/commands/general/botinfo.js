const { EmbedBuilder } = require('discord.js');
const state = require('../../state');
const { CREATOR_ID } = require('../../config');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'botinfo',
    description: 'Get information about the bot'
  },
  async execute(interaction) {
    const client = interaction.client;
    const uptime = Date.now() - state.startTime;
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🤖 Bot Information')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Bot Name', value: client.user.username, inline: true },
        { name: 'Bot ID', value: client.user.id, inline: true },
        { name: 'Created By', value: `<@${CREATOR_ID}>`, inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${client.users.cache.size}`, inline: true },
        { name: 'Uptime', value: formatDuration(uptime), inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Discord.js', value: require('discord.js').version, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
