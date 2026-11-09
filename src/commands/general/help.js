const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');

const CATEGORIES = {
  overview: {
    label: 'Main Menu',
    emoji: '🏠',
    description: 'Return to the overview of all help categories',
    color: '#FFB6E1',
    title: '🌸 Cutie Bot — Help & Command Center',
    descriptionText:
      'Hello! I am **Cutie**, an AI companion and multi-purpose bot for your server. (◕‿◕)♡\n\n' +
      'Select a category from the **dropdown menu below** to explore the complete list of commands and their functions.\n\n' +
      '✨ **Key Highlights:**\n' +
      '• **🤖 Smart AI**: Chat naturally by mentioning the bot or via `/ask`\n' +
      '• **🛠️ Complete Utilities**: Translations, calculator, weather, QR Codes, and dictionaries\n' +
      '• **🛡️ Robust Moderation**: Anti-spam auto-mute, bad words filter, kick/ban/timeout\n' +
      '• **🎮 Fun & Entertainment**: Trivia, polls, anime info, jokes, memes, and crypto prices',
    fields: [
      { name: '🤖 AI & General', value: '`/ask` `/setpersonality` `/profile` `/ping` `/botinfo` `/uptime` `/clearhistory`', inline: true },
      { name: '🎮 Fun & Games', value: '`/roll` `/coinflip` `/8ball` `/joke` `/fact` `/trivia` `/meme` `/quote` `/choose`', inline: true },
      { name: '🛠️ Utilities', value: '`/translate` `/calculate` `/weather` `/wiki` `/urban` `/define` `/qr` `/shorten`', inline: true },
      { name: '🎬 Media', value: '`/anime` `/movie` `/crypto` `/gif` `/cat` `/dog`', inline: true },
      { name: '💬 Social', value: '`/poll` `/remind` `/afk` `/embed`', inline: true },
      { name: '🛡️ Moderation', value: '`/announce` `/ban` `/kick` `/timeout` `/warn` `/clear` `/lock` `/slowmode` `/modstats`', inline: true },
      { name: '⚙️ Server Setup', value: '`/serverconfig` `/setwelcome` `/setgoodbye` `/autorole` `/setlog` `/setaskchannel` `/setautomute`', inline: true },
      { name: '🎭 Roles', value: '`/addrole` `/removerole` `/createrole` `/deleterole` `/roles`', inline: true },
    ],
  },
  ai_general: {
    label: 'AI & General',
    emoji: '🤖',
    description: 'Artificial intelligence commands and general bot information',
    color: '#FFB6E1',
    title: '🤖 Category: AI & General',
    descriptionText: 'Smart conversational companion powered by AI along with general bot commands:',
    fields: [
      { name: '`/ask [question] [image]`', value: 'Ask any question or attach an image for Cutie AI vision analysis.', inline: false },
      { name: '`/setpersonality [style]`', value: 'Switch AI personality (Sweet, Tsundere, Cool, Sarcastic, Assistant).', inline: false },
      { name: '`/clearhistory`', value: 'Clear your conversation memory for a fresh new chat context.', inline: false },
      { name: '`/profile [user]`', value: 'View detailed Discord user profile and server membership.', inline: false },
      { name: '`/avatar [user]`', value: 'View and get the direct link for full-size user avatars.', inline: false },
      { name: '`/ping`', value: 'Check bot latency and Discord WebSocket connection speed.', inline: false },
      { name: '`/botinfo`', value: 'Bot statistics dashboard, RAM usage, and uptime.', inline: false },
      { name: '`/serverinfo`', value: 'Comprehensive information regarding the current server.', inline: false },
      { name: '`/uptime`', value: 'Bot uptime duration since its last startup.', inline: false },
    ],
  },
  fun: {
    label: 'Fun & Games',
    emoji: '🎮',
    description: 'Fun games, mini-challenges, and interactive entertainment',
    color: '#FFD166',
    title: '🎮 Category: Fun & Games',
    descriptionText: 'Casual mini-games and entertainment to liven up your server channels:',
    fields: [
      { name: '`/roll [sides]`', value: 'Roll a dice with custom number of sides (2-1000).', inline: false },
      { name: '`/coinflip`', value: 'Flip a coin to decide choices (Heads vs Tails).', inline: false },
      { name: '`/8ball [question]`', value: 'Ask the magical 8-Ball about your future or questions.', inline: false },
      { name: '`/trivia`', value: 'Test your knowledge with interactive multiple-choice trivia quizzes.', inline: false },
      { name: '`/choose [choices]`', value: 'Undecided? Let the bot pick the best option for you.', inline: false },
      { name: '`/joke`', value: 'Send a funny joke to brighten up your day.', inline: false },
      { name: '`/fact`', value: 'Fascinating and curious fun facts from across the world.', inline: false },
      { name: '`/meme`', value: 'Fetch a random funny meme directly from Reddit.', inline: false },
      { name: '`/quote`', value: 'Motivational and inspiring quotes from great historical figures.', inline: false },
    ],
  },
  utility: {
    label: 'Utilities',
    emoji: '🛠️',
    description: 'Helpful tools for translation, math, weather, and web info',
    color: '#06D6A0',
    title: '🛠️ Category: Utilities',
    descriptionText: 'Practical everyday tools to boost your productivity in the server:',
    fields: [
      { name: '`/translate [text] [to]`', value: 'Translate text into various world languages.', inline: false },
      { name: '`/calculate [expression]`', value: 'Accurate mathematical calculator for complex expressions.', inline: false },
      { name: '`/weather [city]`', value: 'Check weather forecast, temperature, and humidity for any city.', inline: false },
      { name: '`/wiki [query]`', value: 'Search Wikipedia for direct summaries and links.', inline: false },
      { name: '`/urban [term]`', value: 'Look up slang terms and internet phrases on Urban Dictionary.', inline: false },
      { name: '`/define [word]`', value: 'Official English dictionary definition and phonetic transcription.', inline: false },
      { name: '`/qr [text/link]`', value: 'Generate a scannable QR code image from any text or URL.', inline: false },
      { name: '`/shorten [url]`', value: 'Shorten long URLs into clean, compact links.', inline: false },
      { name: '`/ascii [text]`', value: 'Convert standard text into eye-catching ASCII text banners.', inline: false },
      { name: '`/reverse [text]`', value: 'Reverse the order of characters in your text.', inline: false },
    ],
  },
  media: {
    label: 'Media & Pop Culture',
    emoji: '🎬',
    description: 'Anime information, movies, cryptocurrency, and cute pets',
    color: '#118AB2',
    title: '🎬 Category: Media & Pop Culture',
    descriptionText: 'Media searches, crypto market information, and visual fun:',
    fields: [
      { name: '`/anime [title]`', value: 'Synopsis, rating, and episode information from MyAnimeList.', inline: false },
      { name: '`/movie [title]`', value: 'Detailed information and ratings for your favorite movies.', inline: false },
      { name: '`/crypto [coin]`', value: 'Check real-time spot prices of cryptocurrencies (BTC, ETH, etc.).', inline: false },
      { name: '`/gif [search]`', value: 'Search and send funny animated GIFs via Tenor.', inline: false },
      { name: '`/cat`', value: 'Display a cute and adorable random cat photo.', inline: false },
      { name: '`/dog`', value: 'Display a cute and lovely random dog photo.', inline: false },
    ],
  },
  social: {
    label: 'Social & Community',
    emoji: '💬',
    description: 'Interactive polls, reminders, AFK status, and custom embeds',
    color: '#8338EC',
    title: '💬 Category: Social & Community',
    descriptionText: 'Community features for social interaction between server members:',
    fields: [
      { name: '`/poll [question] [options]`', value: 'Create interactive voting polls with automatic number reaction emojis.', inline: false },
      { name: '`/remind [time] [message]`', value: 'Set a scheduled reminder (e.g. 10m, 1h, 2d). The bot will mention you!', inline: false },
      { name: '`/afk [reason]`', value: 'Set AFK (Away From Keyboard) status. Bot alerts users who mention you.', inline: false },
      { name: '`/embed [title] [description]`', value: 'Create neat Discord embed messages with custom styling.', inline: false },
    ],
  },
  moderation: {
    label: 'Moderation',
    emoji: '🛡️',
    description: 'Security management, member discipline, and moderation logs',
    color: '#EF476F',
    title: '🛡️ Category: Moderation',
    descriptionText: 'Dedicated staff/moderator commands to maintain server order:',
    fields: [
      { name: '`/announce [message] [channel] [ping]`', value: 'Broadcast official server announcements with optional @everyone / @here mentions.', inline: false },
      { name: '`/warn [user] [reason]`', value: 'Issue an official warning to a rule-breaking member.', inline: false },
      { name: '`/warnings [user]`', value: 'View warning history recorded for a user.', inline: false },
      { name: '`/clearwarnings [user]`', value: 'Clear all warning records for a user.', inline: false },
      { name: '`/timeout [user] [duration]`', value: 'Temporarily mute/timeout a member (e.g. 10m, 1h, 1d).', inline: false },
      { name: '`/untimeout [user]`', value: 'Lift timeout status from a member before it expires.', inline: false },
      { name: '`/kick [user] [reason]`', value: 'Kick a member from the server.', inline: false },
      { name: '`/ban [user] [reason]`', value: 'Permanently ban a member from the server.', inline: false },
      { name: '`/unban [user_id]`', value: 'Unban a user using their User ID or username.', inline: false },
      { name: '`/clear [amount]`', value: 'Bulk delete messages in the channel (up to 100 messages).', inline: false },
      { name: '`/slowmode [seconds]`', value: 'Set per-user message rate limit slowmode for the channel.', inline: false },
      { name: '`/lock` & `/unlock`', value: 'Lock or unlock message send permissions in the channel.', inline: false },
      { name: '`/modstats`', value: 'View server moderation action breakdown statistics.', inline: false },
    ],
  },
  server: {
    label: 'Server Setup & Automation',
    emoji: '⚙️',
    description: 'Automation configuration, welcome messages, logging, and word filters',
    color: '#3A86FF',
    title: '⚙️ Category: Server Setup & Automation',
    descriptionText: 'System automation and administrative configurations for server quality of life:',
    fields: [
      { name: '`/serverconfig`', value: 'View full dashboard of server automations, log channels, filters, and AI settings.', inline: false },
      { name: '`/setwelcome` & `/removewelcome`', value: 'Configure automatic welcome messages and channel for new members.', inline: false },
      { name: '`/setgoodbye` & `/removegoodbye`', value: 'Configure goodbye messages when a member leaves the server.', inline: false },
      { name: '`/autorole` & `/removeautorole`', value: 'Automatically assign a default role to new members upon joining.', inline: false },
      { name: '`/setlog` & `/removelog`', value: 'Set the dedicated audit log channel for server moderation actions.', inline: false },
      { name: '`/setaskchannel` & `/removeaskchannel`', value: 'Set a dedicated channel for free-flow chat with Cutie AI.', inline: false },
      { name: '`/setautomute` & `/removeautomute`', value: 'Enable anti-spam detection (e.g. 5 messages within 5 seconds).', inline: false },
      { name: '`/addbadword` & `/removebadword`', value: 'Manage the server blacklisted / forbidden words filter list.', inline: false },
      { name: '`/setbadwordmute`', value: 'Enable auto-mute when members use blacklisted words.', inline: false },
    ],
  },
  roles: {
    label: 'Role Management',
    emoji: '🎭',
    description: 'Creation, removal, assignment, and inspection of server roles',
    color: '#9C27B0',
    title: '🎭 Category: Role Management',
    descriptionText: 'Fast and convenient server role management:',
    fields: [
      { name: '`/addrole [user] [role]`', value: 'Assign a role to a specified member.', inline: false },
      { name: '`/removerole [user] [role]`', value: 'Remove a role from a specified member.', inline: false },
      { name: '`/createrole [name] [color]`', value: 'Create a new role with a custom name and color hex.', inline: false },
      { name: '`/deleterole [role]`', value: 'Delete an unused role from the server.', inline: false },
      { name: '`/roleinfo [role]`', value: 'Inspect detailed role permissions and member count.', inline: false },
      { name: '`/roles`', value: 'List all existing roles present in the server.', inline: false },
    ],
  },
};

function buildCategoryEmbed(categoryKey) {
  const cat = CATEGORIES[categoryKey] || CATEGORIES.overview;

  const embed = new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(cat.title)
    .setDescription(cat.descriptionText)
    .setFooter({ text: 'Use the dropdown menu below to switch categories • Cutie Bot' })
    .setTimestamp();

  if (cat.fields && cat.fields.length > 0) {
    embed.addFields(cat.fields);
  }

  return embed;
}

function buildSelectMenu(selectedKey = 'overview') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('📂 Select a Help Category...')
    .addOptions(
      Object.entries(CATEGORIES).map(([key, item]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(item.label)
          .setValue(key)
          .setDescription(item.description.substring(0, 100))
          .setEmoji(item.emoji)
          .setDefault(key === selectedKey)
      )
    );

  return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
  data: {
    name: 'help',
    description: 'Open the help menu and complete command guide for Cutie bot',
  },
  async execute(interaction) {
    await interaction.deferReply();

    let currentCategory = 'overview';
    const initialEmbed = buildCategoryEmbed(currentCategory);
    const initialRow = buildSelectMenu(currentCategory);

    const message = await interaction.editReply({
      embeds: [initialEmbed],
      components: [initialRow],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (selectInteraction) => {
      // Allow everyone or command user to interact
      const selectedKey = selectInteraction.values[0];
      currentCategory = selectedKey;

      const newEmbed = buildCategoryEmbed(selectedKey);
      const newRow = buildSelectMenu(selectedKey);

      await selectInteraction.update({
        embeds: [newEmbed],
        components: [newRow],
      }).catch(() => {});
    });

    collector.on('end', async () => {
      try {
        const disabledSelect = new StringSelectMenuBuilder()
          .setCustomId('help_category_disabled')
          .setPlaceholder('⏳ Help menu has expired. Type /help again.')
          .setDisabled(true)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Expired')
              .setValue('expired')
          );

        await message.edit({
          components: [new ActionRowBuilder().addComponents(disabledSelect)],
        }).catch(() => {});
      } catch {
        // Message might have been deleted
      }
    });
  },
};
