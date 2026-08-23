const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'help',
    description: 'Display all available commands and their descriptions'
  },
  async execute(interaction) {
    await interaction.deferReply();

    const helpEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📚 Bot Commands Help')
      .setDescription('Here are all available commands organized by category:')
      .addFields(
        { name: '🤖 General', value: '`/ask` `/help` `/ping` `/profile` `/avatar` `/serverinfo` `/botinfo` `/uptime`', inline: false },
        { name: '🎮 Fun & Games', value: '`/roll` `/coinflip` `/8ball` `/joke` `/fact` `/trivia` `/meme` `/quote` `/choose`', inline: false },
        { name: '🛠️ Utilities', value: '`/translate` `/calculate` `/weather` `/wiki` `/urban` `/define` `/qr` `/shorten` `/reverse` `/ascii`', inline: false },
        { name: '🎬 Media', value: '`/movie` `/anime` `/gif` `/dog` `/cat` `/crypto`', inline: false },
        { name: '👥 User Info', value: '`/userinfo` `/roleinfo` `/roles`', inline: false },
        { name: '💬 Social', value: '`/poll` `/embed` `/afk` `/remind`', inline: false },
        { name: '🛡️ Moderation', value: '`/ban` `/unban` `/kick` `/timeout` `/warn` `/clear` `/lock` `/unlock` `/slowmode` `/setautomute` `/setbadwordmute`', inline: false },
        { name: '🔇 Auto-Mute', value: '`/setautomute` `/removeautomute` `/setbadwordmute` `/removebadwordmute` `/addbadword` `/removebadword` `/listbadwords`', inline: false },
        { name: '🎭 Roles', value: '`/addrole` `/removerole` `/createrole` `/deleterole`', inline: false },
        { name: '⚙️ Server Setup', value: '`/setwelcome` `/setgoodbye` `/autorole` `/setlog`', inline: false }
      )
      .setFooter({ text: 'Use /command to execute any command' })
      .setTimestamp();

    await interaction.editReply({ embeds: [helpEmbed] });
  }
};
