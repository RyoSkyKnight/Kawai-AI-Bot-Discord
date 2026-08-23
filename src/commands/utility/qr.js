const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'qr',
    description: 'Generate a QR code',
    options: [
      {
        name: 'text',
        type: 3,
        description: 'Text or URL to encode',
        required: true
      }
    ]
  },
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(text)}`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📱 QR Code Generated')
      .setImage(qrUrl)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
