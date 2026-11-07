const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} = require('discord.js');

/**
 * Splits text into chunks suitable for Discord message content (max 2000 chars).
 * Splits along paragraph or line boundaries and safely preserves markdown codeblocks.
 */
function splitResponseIntoChunks(text, maxChunkLength = 1950) {
  if (!text || text.length <= maxChunkLength) {
    return [text || ''];
  }

  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let inCodeBlock = false;
  let codeBlockLanguage = '';

  for (const line of lines) {
    const codeBlockMatch = line.match(/^```(\w+)?/);
    const togglesCodeBlock = line.startsWith('```');

    if (currentChunk.length + line.length + 1 > maxChunkLength && currentChunk.length > 0) {
      if (inCodeBlock) {
        currentChunk += '\n```';
      }
      chunks.push(currentChunk.trim());

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
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [''];
}

/**
 * Legacy thinking embed helper for backward compatibility.
 */
function createThinkingEmbed(personality) {
  return null;
}

/**
 * Legacy embed builder for backward compatibility.
 */
function buildModernAiEmbed({
  pageText,
  personality,
  latency,
  user,
  pageIndex,
  totalPages,
}) {
  const p = personality || { name: 'Cutie', color: '#FF69B4' };
  const embed = new EmbedBuilder()
    .setColor(p.color || '#FF69B4')
    .setTitle(`Cutie • ${p.name || 'Companion'}`)
    .setDescription(pageText)
    .setTimestamp();

  if (user) {
    embed.setAuthor({
      name: user.displayName || user.username,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    });
  }

  return embed;
}

/**
 * Legacy button builder for backward compatibility.
 */
function buildModernActionRows({
  pageIndex,
  totalPages,
  isProcessing = false,
  uniqueId = '',
}) {
  return [];
}

/**
 * Sends or edits the AI chat response as natural plain text without embeds.
 * Preserves freshness, intimacy, and full conversational naturalness.
 */
async function sendModernAiResponse({
  target,
  user,
  prompt,
  aiResult,
}) {
  let text = typeof aiResult === 'object' && aiResult.text ? aiResult.text : String(aiResult || '');
  const chunks = splitResponseIntoChunks(text, 1950);

  const firstPayload = {
    content: chunks[0] || '*(Cutie tersenyum manis...)*',
    embeds: [],
    components: [],
  };

  let responseMessage = null;

  try {
    if (typeof target.editReply === 'function') {
      // Interaction (slash command /ask)
      responseMessage = await target.editReply(firstPayload);
    } else if (typeof target.edit === 'function') {
      // Message edit (placeholder response)
      responseMessage = await target.edit(firstPayload);
    } else if (typeof target.reply === 'function') {
      // Message direct reply
      responseMessage = await target.reply(firstPayload);
    }
  } catch (err) {
    console.error('Error sending AI response:', err);
    if (target.channel && typeof target.channel.send === 'function') {
      responseMessage = await target.channel.send(firstPayload).catch(() => null);
    }
  }

  // If response exceeds 2000 characters, send additional chunks as sequential messages
  if (chunks.length > 1) {
    const channel = target.channel;
    for (let i = 1; i < chunks.length; i++) {
      try {
        if (typeof target.followUp === 'function') {
          await target.followUp({ content: chunks[i] });
        } else if (channel && typeof channel.send === 'function') {
          await channel.send({ content: chunks[i] });
        }
      } catch (chunkErr) {
        console.error('Error sending response chunk:', chunkErr);
      }
    }
  }

  return responseMessage;
}

module.exports = {
  splitResponseIntoPages: splitResponseIntoChunks,
  splitResponseIntoChunks,
  createThinkingEmbed,
  buildModernAiEmbed,
  buildModernActionRows,
  sendModernAiResponse,
};
