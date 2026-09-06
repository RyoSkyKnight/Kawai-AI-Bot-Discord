const { EmbedBuilder } = require('discord.js');
const state = require('../../state');
const { CREATOR_ID } = require('../../config');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: {
    name: 'botinfo',
    description: 'Tampilkan dashboard statistik dan informasi sistem bot Cutie',
  },
  async execute(interaction) {
    const client = interaction.client;
    const uptime = Date.now() - state.startTime;
    const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
    const memHeap = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const memRss = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor('#B4E7FF')
      .setTitle('📊 Cutie AI — System & Bot Dashboard')
      .setDescription('Asisten bot AI Discord modern bertenaga OpenRouter & Node.js.')
      .setThumbnail(client.user.displayAvatarURL({ size: 512, dynamic: true }))
      .addFields(
        { name: '🤖 Nama Bot', value: `\`${client.user.username}\``, inline: true },
        { name: '👑 Pencipta', value: CREATOR_ID ? `<@${CREATOR_ID}>` : '`RyoSkyKnight`', inline: true },
        { name: '🟢 Status Sistem', value: '`Operational`', inline: true },
        { name: '🌐 Server Aktif', value: `\`${client.guilds.cache.size} server\``, inline: true },
        { name: '👥 Total Anggota', value: `\`${totalUsers.toLocaleString()} member\``, inline: true },
        { name: '⏳ Waktu Aktif (Uptime)', value: `\`${formatDuration(uptime)}\``, inline: true },
        { name: '🧠 Penggunaan RAM', value: `\`${memHeap} MB Heap / ${memRss} MB RSS\``, inline: true },
        { name: '⚡ Latensi WebSocket', value: `\`${Math.round(client.ws.ping)}ms\``, inline: true },
        { name: '📦 Engine & Framework', value: `\`Node.js ${process.version}\`\n\`discord.js v${require('discord.js').version}\``, inline: true }
      )
      .setFooter({
        text: 'Cutie System Monitor • Kawai AI Bot Discord',
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
