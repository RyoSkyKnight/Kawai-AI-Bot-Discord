const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} = require('discord.js');

/**
 * Splits a long text into multiple chunks suitable for Discord Embed descriptions (max 4096 chars).
 * We use 3500 chars as a safe threshold and split along paragraph/line boundaries.
 */
function splitResponseIntoPages(text, maxPageLength = 3500) {
  if (!text || text.length <= maxPageLength) {
    return [text || ''];
  }

  const pages = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let inCodeBlock = false;
  let codeBlockLanguage = '';

  for (const line of lines) {
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
 * Builds an aesthetic "Thinking" loading embed.
 */
function createThinkingEmbed(personality) {
  const p = personality || { name: 'Cutie', color: '#3498DB' };
  return new EmbedBuilder()
    .setColor(p.color || '#3498DB')
    .setTitle('Thinking...')
    .setDescription('Processing your request...')
    .setFooter({ text: 'Cutie AI' });
}

/**
 * Builds the modern response embed.
 */
function buildModernAiEmbed({
  pageText,
  personality,
  latency,
  user,
  pageIndex,
  totalPages,
}) {
  const p = personality || { name: 'Cutie', color: '#3498DB' };

  const embed = new EmbedBuilder()
    .setColor(p.color || '#3498DB')
    .setTitle(`Cutie AI • ${p.name || 'Assistant'}`)
    .setDescription(pageText)
    .setTimestamp();

  if (user) {
    embed.setAuthor({
      name: `Asked by ${user.displayName || user.username}`,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    });
  }

  const footerParts = [];
  if (latency != null) footerParts.push(`${latency}ms`);
  footerParts.push('OpenRouter AI');
  if (totalPages > 1) {
    footerParts.push(`Page ${pageIndex + 1}/${totalPages}`);
  }
  embed.setFooter({ text: footerParts.join(' • ') });

  return embed;
}

/**
 * Builds the interactive Action Rows (Paginator + Delete button).
 */
function buildModernActionRows({
  pageIndex,
  totalPages,
  isProcessing = false,
  uniqueId = '',
}) {
  const rows = [];
  const controlButtons = [];

  // Paginator buttons if more than 1 page
  if (totalPages > 1) {
    controlButtons.push(
      new ButtonBuilder()
        .setCustomId(`ai_prev_${uniqueId}`)
        .setLabel('Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === 0 || isProcessing)
    );

    controlButtons.push(
      new ButtonBuilder()
        .setCustomId(`ai_page_${uniqueId}`)
        .setLabel(`${pageIndex + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    controlButtons.push(
      new ButtonBuilder()
        .setCustomId(`ai_next_${uniqueId}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === totalPages - 1 || isProcessing)
    );
  }

  // Delete button
  controlButtons.push(
    new ButtonBuilder()
      .setCustomId(`ai_delete_${uniqueId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isProcessing)
  );

  if (controlButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(controlButtons));
  }

  return rows;
}

/**
 * Sends or edits a message to display the modern AI response, and attaches the interactive collector.
 */
async function sendModernAiResponse({
  target,
  user,
  prompt,
  aiResult,
}) {
  let text = typeof aiResult === 'object' && aiResult.text ? aiResult.text : String(aiResult || '');
  let personality = aiResult?.personality;
  let latency = aiResult?.latency;

  const pages = splitResponseIntoPages(text);
  let currentPage = 0;
  const uniqueId = `${user.id}_${Date.now()}`;

  const renderPayload = (isProcessing = false) => {
    const embed = buildModernAiEmbed({
      pageText: pages[currentPage],
      personality,
      latency,
      user,
      pageIndex: currentPage,
      totalPages: pages.length,
      prompt,
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

  let responseMessage;
  if (typeof target.editReply === 'function') {
    responseMessage = await target.editReply(renderPayload(false));
  } else if (typeof target.edit === 'function') {
    responseMessage = await target.edit(renderPayload(false));
  }

  if (!responseMessage) return;

  // Setup component collector for 5 minutes
  const collector = responseMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  });

  collector.on('collect', async (interaction) => {
    const isAuthor = interaction.user.id === user.id;
    const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

    if (!isAuthor && !isMod) {
      await interaction.reply({
        content: `Only <@${user.id}> or a moderator can use these controls.`,
        ephemeral: true,
      });
      return;
    }

    const customId = interaction.customId;

    if (customId === `ai_delete_${uniqueId}`) {
      collector.stop('deleted');
      await responseMessage.delete().catch(() => {});
      return;
    }

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

  collector.on('end', async (_, reason) => {
    if (reason === 'deleted') return;
    try {
      const disabledRows = buildModernActionRows({
        pageIndex: currentPage,
        totalPages: pages.length,
        isProcessing: true,
        uniqueId,
      });
      await responseMessage.edit({ components: disabledRows }).catch(() => {});
    } catch {
      // Message may already be deleted, ignore
    }
  });
}

module.exports = {
  splitResponseIntoPages,
  createThinkingEmbed,
  buildModernAiEmbed,
  buildModernActionRows,
  sendModernAiResponse,
};
