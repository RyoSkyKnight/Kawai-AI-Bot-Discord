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
    // Check if line toggles a code block
    const codeBlockMatch = line.match(/^```(\w+)?/);
    const togglesCodeBlock = line.startsWith('```');

    // If adding this line exceeds maxPageLength, push current chunk as page
    if (currentChunk.length + line.length + 1 > maxPageLength && currentChunk.length > 0) {
      if (inCodeBlock) {
        // Safely close the codeblock on this page
        currentChunk += '\n```';
      }
      pages.push(currentChunk.trim());

      // Start next page, reopening code block if needed
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
  const p = personality || { emoji: '✨', name: 'Cutie', color: '#FFB6E1' };
  return new EmbedBuilder()
    .setColor(p.color || '#FFB6E1')
    .setTitle(`${p.emoji || '✨'} Cutie sedang berpikir...`)
    .setDescription('*Sedang merenung dan meracik jawaban terbaik untukmu...* 💭')
    .setFooter({ text: '⚡ Memproses AI...' });
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
  prompt,
}) {
  const p = personality || { emoji: '💖', name: 'Sweet', color: '#FFB6E1' };

  const embed = new EmbedBuilder()
    .setColor(p.color || '#FFB6E1')
    .setTitle(`${p.emoji} Cutie AI • ${p.name}`)
    .setDescription(pageText)
    .setTimestamp();

  if (user) {
    embed.setAuthor({
      name: `Ditanyakan oleh ${user.displayName || user.username}`,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    });
  }

  const footerParts = [];
  if (latency != null) footerParts.push(`⚡ ${latency}ms`);
  footerParts.push('OpenRouter AI');
  if (totalPages > 1) {
    footerParts.push(`Halaman ${pageIndex + 1}/${totalPages}`);
  }
  embed.setFooter({ text: footerParts.join(' • ') });

  return embed;
}

/**
 * Builds the interactive Action Rows (Paginator + Regenerate & Delete buttons).
 */
function buildModernActionRows({
  pageIndex,
  totalPages,
  isProcessing = false,
  canRegen = true,
  uniqueId = '',
}) {
  const rows = [];

  const controlButtons = [];

  // Paginator buttons if more than 1 page
  if (totalPages > 1) {
    controlButtons.push(
      new ButtonBuilder()
        .setCustomId(`ai_prev_${uniqueId}`)
        .setEmoji('◀')
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
        .setEmoji('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === totalPages - 1 || isProcessing)
    );
  }

  // Regenerate button
  if (canRegen) {
    controlButtons.push(
      new ButtonBuilder()
        .setCustomId(`ai_regen_${uniqueId}`)
        .setLabel('Regenerate')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isProcessing)
    );
  }

  // Delete button
  controlButtons.push(
    new ButtonBuilder()
      .setCustomId(`ai_delete_${uniqueId}`)
      .setLabel('Hapus')
      .setEmoji('🗑️')
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
 *
 * @param {Object} options
 * @param {import('discord.js').Message|import('discord.js').CommandInteraction} options.target - Message or Interaction to edit.
 * @param {import('discord.js').User} options.user - The original author who asked the question.
 * @param {string} options.prompt - The question prompt.
 * @param {Object} options.aiResult - Returned object from processAiChat ({ text, personality, latency }).
 * @param {Function} [options.onRegenerate] - Callback to re-generate the answer.
 */
async function sendModernAiResponse({
  target,
  user,
  prompt,
  aiResult,
  onRegenerate,
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
      canRegen: typeof onRegenerate === 'function',
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
    // Only author or moderators can use controls
    const isAuthor = interaction.user.id === user.id;
    const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

    if (!isAuthor && !isMod) {
      await interaction.reply({
        content: `❌ Hanya <@${user.id}> atau moderator yang dapat mengontrol pesan ini.`,
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

    if (customId === `ai_regen_${uniqueId}`) {
      if (typeof onRegenerate !== 'function') return;

      // Show thinking state
      const thinkingEmbed = createThinkingEmbed(personality);
      await interaction.update({
        embeds: [thinkingEmbed],
        components: buildModernActionRows({
          pageIndex: currentPage,
          totalPages: pages.length,
          isProcessing: true,
          canRegen: false,
          uniqueId,
        }),
      }).catch(() => {});

      try {
        const newResult = await onRegenerate();
        text = typeof newResult === 'object' && newResult.text ? newResult.text : String(newResult || '');
        personality = newResult?.personality || personality;
        latency = newResult?.latency || latency;

        const newPages = splitResponseIntoPages(text);
        pages.length = 0;
        pages.push(...newPages);
        currentPage = 0;

        await responseMessage.edit(renderPayload(false)).catch(() => {});
      } catch (err) {
        console.error('Error during regenerate:', err);
        await responseMessage.edit({
          content: '❌ Gagal membuat ulang jawaban. Silakan coba lagi nanti.',
          components: [],
        }).catch(() => {});
      }
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'deleted') return;
    // Disable all buttons when collector times out
    try {
      const disabledRows = buildModernActionRows({
        pageIndex: currentPage,
        totalPages: pages.length,
        isProcessing: true,
        canRegen: false,
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
