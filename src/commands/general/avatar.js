const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'avatar',
    description: "Get user's avatar in high quality",
    options: [
      {
        name: 'user',
        description: 'The user whose avatar you want to see',
        type: 6,
        required: false
      }
    ]
  },
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🖼️ ${user.username}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setDescription(`[Download Avatar](${user.displayAvatarURL({ size: 1024 })})`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
