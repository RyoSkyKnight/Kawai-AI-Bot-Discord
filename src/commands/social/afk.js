const { EmbedBuilder } = require('discord.js');
const state = require('../../state');

module.exports = {
  data: {
    name: 'afk',
    description: 'Set your AFK status',
    options: [
      { name: 'reason', type: 3, description: 'Reason for being AFK', required: false }
    ]
  },
  async execute(interaction) {
    const reason = interaction.options.getString('reason') || 'AFK';
    state.afkUsers.set(interaction.user.id, { reason, time: Date.now() });

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('😴 AFK Status Set')
      .setDescription(`You are now AFK: **${reason}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
