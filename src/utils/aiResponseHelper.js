const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} = require('discord.js');

/**
 * Splits text into pages suitable for Discord Embed descriptions (max 4096 chars, safe limit 3800).
 * Splits along paragraph or line boundaries and safely preserves markdown codeblocks.
 */
function splitResponseIntoPages(text, maxPageLength = 3800) {
  if (!text || text.length <= maxPageLength) {
    return [text || ''];
  }

  const pages = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let inCodeBlock = false;
  let codeBlockLanguage = '';

  for (let line of lines) {
    // If a single unbroken line exceeds maxPageLength, slice it cleanly
    while (line.length > maxPageLength) {
      const sliceLength = line.lastIndexOf(' ', maxPageLength) > 0
        ? line.lastIndexOf(' ', maxPageLength)
        : maxPageLength;
      const part = line.slice(0, sliceLength);
      line = line.slice(sliceLength).trimStart();

      if (currentChunk.length > 0) {
        if (inCodeBlock) currentChunk += '\n```';
        pages.push(currentChunk.trim());
        currentChunk = inCodeBlock ? '```' + codeBlockLanguage + '\n' : '';
      }
      pages.push(part.trim());
    }

    const codeBlockMatch = line.match(/^```(\w+)?/);
    const togglesCodeBlock = line.startsWith('```');

    if (currentChunk.length + line.length + 1 > maxPageLength && currentChunk.length > 0) {
      if (inCodeBlock) {
        currentChunk += '\n```';
      }
      pages.push(currentChunk.trim());

      if (inCodeBlock) {
        currentChunk = '```' + codeBlockLanguage + '\n' + line + '\n';
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }

    if (togglesCodeBlock) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLanguage = codeBlockMatch ? codeBlockMatch[1] || '' : '';
      } else {
        inCodeBlock = false;
        codeBlockLanguage = '';
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    pages.push(currentChunk.trim());
  }

  return pages.length > 0 ? pages : [''];
}

/**
 * Builds an aesthetic "Thinking" loading embed with personality styling.
 */
function createThinkingEmbed(personality) {
  const p = personality || { name: 'Cutie', color: '#FF69B4', emoji: '💕' };
  return new EmbedBuilder()
    .setColor(p.color || '#FF69B4')
    .setTitle(`${p.emoji || '💕'} Cutie AI • ${p.name || 'Companion'}`)
    .setDescription('*(Cutie sedang berpikir dan menyiapkan jawaban terbaik untuk Master...)* ✨')
    .setFooter({ text: `${p.name || 'Cutie'} AI • Sedang memproses...` });
}

/**
 * Builds the modern response embed wrapped in Discord EmbedBuilder.
 */
function buildModernAiEmbed({
  pageText,
  personality,
  latency,
  user,
  pageIndex = 0,
  totalPages = 1,
}) {
  const p = personality || { name: 'Cutie', color: '#FF69B4', emoji: '💕' };
  const embed = new EmbedBuilder()
    .setColor(p.color || '#FF69B4')
    .setTitle(`${p.emoji || '💕'} Cutie AI • ${p.name || 'Companion'}`)
    .setDescription(pageText || '*(Cutie tersenyum manis...)*')
    .setTimestamp();

  if (user) {
    embed.setAuthor({
      name: `Asked by ${user.displayName || user.username}`,
      iconURL: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ dynamic: true }) : undefined,
    });
  }

  const footerParts = [];
  if (p.name) footerParts.push(p.name);
  if (latency != null) footerParts.push(`${latency}ms`);
  footerParts.push('OpenRouter AI');
  if (totalPages > 1) {
    footerParts.push(`Page ${pageIndex + 1}/${totalPages}`);
  }
  embed.setFooter({ text: footerParts.join(' • ') });

  return embed;
}

/**
 * Builds the interactive Action Rows (Paginator buttons).
 */
function buildModernActionRows({
  pageIndex = 0,
  totalPages = 1,
  isProcessing = false,
  uniqueId = '',
}) {
  if (totalPages <= 1) return [];

  const controlButtons = [
    new ButtonBuilder()
      .setCustomId(`ai_prev_${uniqueId}`)
      .setLabel('Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0 || isProcessing),
    new ButtonBuilder()
      .setCustomId(`ai_page_${uniqueId}`)
      .setLabel(`${pageIndex + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`ai_next_${uniqueId}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1 || isProcessing),
  ];

  return [new ActionRowBuilder().addComponents(controlButtons)];
}

/**
 * Sends or edits the AI chat response wrapped inside an aesthetic Discord Embed card.
 * Preserves the rich anime companion persona, expressions, and tone.
 */
async function sendModernAiResponse({
  target,
  user,
  prompt,
  aiResult,
}) {
  let text = typeof aiResult === 'object' && aiResult.text ? aiResult.text : String(aiResult || '');
  const pInfo = typeof aiResult === 'object' && aiResult.personality ? aiResult.personality : null;
  const latency = typeof aiResult === 'object' ? aiResult.latency : null;

  const pages = splitResponseIntoPages(text, 3800);
  const uniqueId = Math.random().toString(36).substring(2, 8);
  let currentPage = 0;

  const renderPayload = (isProcessing = false) => {
    const embed = buildModernAiEmbed({
      pageText: pages[currentPage],
      personality: pInfo,
      latency,
      user,
      pageIndex: currentPage,
      totalPages: pages.length,
    });

    const components = buildModernActionRows({
      pageIndex: currentPage,
      totalPages: pages.length,
      isProcessing,
      uniqueId,
    });

    return {
      content: null,
      embeds: [embed],
      components,
    };
  };

  let responseMessage = null;

  try {
    if (typeof target.editReply === 'function') {
      // Interaction (slash command /ask)
      responseMessage = await target.editReply(renderPayload(false));
    } else if (typeof target.edit === 'function') {
      // Message edit (placeholder response from messageCreate)
      responseMessage = await target.edit(renderPayload(false));
    } else if (typeof target.reply === 'function') {
      // Message direct reply
      responseMessage = await target.reply(renderPayload(false));
    }
  } catch (err) {
    console.error('Error sending AI response:', err);
    if (target.channel && typeof target.channel.send === 'function') {
      responseMessage = await target.channel.send(renderPayload(false)).catch(() => null);
    }
  }

  if (!responseMessage || pages.length <= 1) return responseMessage;

  // Setup component collector for 5 minutes for pagination
  try {
    const collector = responseMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (interaction) => {
      const isAuthor = user && interaction.user.id === user.id;
      const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

      if (!isAuthor && !isMod) {
        await interaction.reply({
          content: user ? `Only <@${user.id}> or a moderator can use these controls.` : 'You cannot use these controls.',
          ephemeral: true,
        });
        return;
      }

      const customId = interaction.customId;

      if (customId === `ai_prev_${uniqueId}`) {
        if (currentPage > 0) currentPage--;
        await interaction.update(renderPayload(false)).catch(() => {});
        return;
      }

      if (customId === `ai_next_${uniqueId}`) {
        if (currentPage < pages.length - 1) currentPage++;
        await interaction.update(renderPayload(false)).catch(() => {});
        return;
      }
    });

    collector.on('end', async () => {
      try {
        const disabledRows = buildModernActionRows({
          pageIndex: currentPage,
          totalPages: pages.length,
          isProcessing: true,
          uniqueId,
        });
        await responseMessage.edit({ components: disabledRows }).catch(() => {});
      } catch {
        // Message may already be deleted or expired, ignore
      }
    });
  } catch (collectorErr) {
    console.error('Error attaching pagination collector:', collectorErr);
  }

  return responseMessage;
}

module.exports = {
  splitResponseIntoPages,
  splitResponseIntoChunks: splitResponseIntoPages,
  createThinkingEmbed,
  buildModernAiEmbed,
  buildModernActionRows,
  sendModernAiResponse,
};
