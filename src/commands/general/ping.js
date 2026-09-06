const { EmbedBuilder } = require('discord.js');

function getLatencyBadge(ms) {
  if (ms <= 100) return { emoji: '🟢', label: 'Sangat Cepat (Excellent)', color: '#06D6A0' };
  if (ms <= 250) return { emoji: '🟡', label: 'Normal (Good)', color: '#FFD166' };
  return { emoji: '🔴', label: 'Tinggi (Laggy)', color: '#EF476F' };
}

function getSignalBar(ms) {
  if (ms <= 60) return '`[■■■■■■■■■■]` 100%';
  if (ms <= 120) return '`[■■■■■■■■□□]` 80%';
  if (ms <= 200) return '`[■■■■■■□□□□]` 60%';
  if (ms <= 350) return '`[■■■■□□□□□□]` 40%';
  return '`[■■□□□□□□□□]` 20%';
}

module.exports = {
  data: {
    name: 'ping',
    description: 'Cek latensi respons bot dan koneksi WebSocket Discord',
  },
  async execute(interaction) {
    const sent = await interaction.reply({
      content: '🏓 *Mengukur kecepatan koneksi Cutie...*',
      fetchReply: true,
    });

    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = Math.round(interaction.client.ws.ping);
    const badge = getLatencyBadge(roundTrip);
    const signalBar = getSignalBar(roundTrip);
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor(badge.color)
      .setTitle('🏓 Pong! Status Koneksi Cutie')
      .setDescription(`Kualitas jaringan bot saat ini: **${badge.emoji} ${badge.label}**\n${signalBar}`)
      .addFields(
        { name: '⚡ Round-trip Latency', value: `\`${roundTrip}ms\``, inline: true },
        { name: '🌐 Discord WebSocket', value: `\`${wsPing}ms\``, inline: true },
        { name: '💾 Heap Memory', value: `\`${memUsage} MB\``, inline: true }
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag} • Cutie Diagnostics`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
