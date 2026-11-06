const { CREATOR_ID, USE_SHORT_RESPONSE } = require('../config');
const { chatCompletion } = require('./aiClient');
const { getToolDefinitions, runTool } = require('./aiTools');
const { getHistory, pushHistory } = require('./conversationHistory');
const { getGuildSettings } = require('./guildSettings');
const { getUserPersonality } = require('./userPersonality');
const { PERSONALITIES } = require('../utils/constants');

const MAX_TOOL_ROUNDS = 3;

let cachedCreator = null;

async function getCreatorInfo(client) {
  if (cachedCreator) return cachedCreator;

  let creatorName = 'my amazing creator';
  const creatorMention = `<@${CREATOR_ID}>`;

  if (client && CREATOR_ID) {
    try {
      const creatorUser = await client.users.fetch(CREATOR_ID);
      if (creatorUser && creatorUser.username) {
        creatorName = creatorUser.username;
      }
    } catch (err) {
      console.log('Could not fetch creator user info');
    }
  }

  cachedCreator = { name: creatorName, mention: creatorMention };
  return cachedCreator;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves Discord user mentions in the prompt string.
 */
async function resolveMentions(prompt, client) {
  const mentionRegex = /<@!?(\d{17,20})>/g;
  let match;
  const resolvedMentions = [];
  const seenIds = new Set();

  while ((match = mentionRegex.exec(prompt)) !== null) {
    const id = match[1];
    if (!seenIds.has(id)) {
      seenIds.add(id);
      try {
        const resolvedUser = await client.users.fetch(id);
        resolvedMentions.push({ id, username: resolvedUser.username });
      } catch (err) {
        // Ignore fetch errors for non-existent users
      }
    }
  }

  return resolvedMentions;
}

/**
 * Resolves the effective personality for a user/guild context.
 */
async function getEffectivePersonality(userId, guildId) {
  let personality = 'sweet';
  const userPers = await getUserPersonality(userId);
  if (userPers && PERSONALITIES[userPers]) {
    personality = userPers;
  } else if (guildId) {
    const settings = await getGuildSettings(guildId);
    if (settings && settings.personality && PERSONALITIES[settings.personality]) {
      personality = settings.personality;
    }
  }
  return PERSONALITIES[personality] || PERSONALITIES['sweet'];
}

/**
 * Builds the system instruction prompt based on personality, tools, and mentions.
 */
async function buildSystemInstruction({ userId, guildId, creatorInfo, tools, resolvedMentions, pInfo }) {
  if (!pInfo) {
    pInfo = await getEffectivePersonality(userId, guildId);
  }

  const toolsListStr = tools.map((t) => t.function.name).join(', ');
  const toolsNote = tools.length > 0
    ? `\n\nAVAILABLE TOOLS & ACTIONS (${toolsListStr}):
- When the user asks to be reminded, set a timer, or count down time (e.g. "tolong ingatkan aku dalam 1 menit ya", "set timer 5 menit", "ingetin 10 menit lagi", "remind me in 1 hour"), you MUST call the "set_timer" or "set_reminder" tool. Never just say you will remind them without calling the tool!
- When the user asks for exact math calculation (e.g. "hitung 25 * 40"), call the "calculate" tool.
- When the user asks to choose between options (e.g. "pilihin antara bakso atau sate", "choose between movie or gaming"), call "choose_option".
- When asked to flip a coin ("lempar koin") or roll a dice ("roll dadu 1-20"), call "flip_coin" or "roll_dice".
- When the user asks to create a voting poll ("bikinin polling..."), call "create_poll".
- When the user wants to take notes / manage to-do list ("catat to-do...", "lihat to-do ku", "hapus todo..."), call "manage_todo".
- When a server moderator asks to delete messages ("hapus 10 pesan") or set slowmode ("pasang slowmode 10s"), call "clear_messages" or "set_slowmode".
- When asked for slang word definitions ("arti kata rizz / skibidi"), call "urban_dictionary".
- When asked to generate a QR code ("buatkan QR code untuk link..."), call "generate_qr".
- When asked for quotes, facts, weather, crypto prices, jokes, memes, anime, or Wikipedia info, call the respective tool.
- If a tool executes successfully, provide a cheerful, polite, and concise confirmation (1-2 sentences) about the action done.`
    : '';

  let mentionsNote = '';
  if (resolvedMentions.length > 0) {
    mentionsNote = `\n\nResolved user mentions in this query:\n` +
      resolvedMentions.map(m => `- User <@${m.id}> has username "${m.username}" (ID: ${m.id})`).join('\n') +
      `\nAlways use the exact mention format <@USER_ID> (for example, <@${resolvedMentions[0].id}>) in your response if you want to tag or refer to them. Do NOT convert mentions to plain text like "@username".`;
  }

  const toneAndLengthGuideline = USE_SHORT_RESPONSE
    ? `\n\nGUIDELINES:
- LANGUAGE: Always match the language the user speaks in. If asked in Indonesian, answer in natural Indonesian. If asked in English, answer in English.
- EMOJIS: Do NOT use emojis. Keep responses completely free of emojis.
- LENGTH & STYLE: Keep answers concise, clear, and direct in 1-3 sentences without filler.`
    : `\n\nGUIDELINES:
- LANGUAGE ADAPTATION: Always reply in the EXACT language used by the user in their prompt. If the user writes in Indonesian, respond naturally and fluently in Indonesian. If in English, respond in English. If in another language, adapt accordingly.
- EMOJIS: Do NOT use emojis under any circumstances. Keep all responses clean, professional, and free of emojis.
- STYLE & TONE: Clear, helpful, natural, and direct. Avoid rambling, unnecessary apologies, robotic greetings, or roleplay text (*giggles*, *blushes*).
- For casual chat: 1-3 concise, engaging sentences.
- For technical explanations or tutorials: structured, clean, and easy to read.
- Do NOT repeat the user's question back to them.`;

  return `${pInfo.instruction}` +
    `\nImportant: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorInfo.name}.` +
    toneAndLengthGuideline +
    toolsNote +
    mentionsNote;
}

/**
 * Executes a full AI chat turn with tools and history.
 *
 * @param {Object} context
 * @param {string} context.prompt - The input text from user.
 * @param {import('discord.js').User} context.user - Discord user object.
 * @param {import('discord.js').GuildMember|null} context.member - Guild member object (if in guild).
 * @param {import('discord.js').Guild|null} context.guild - Guild object (if in guild).
 * @param {import('discord.js').TextChannel|import('discord.js').DMChannel} context.channel - Discord channel.
 * @param {import('discord.js').Client} context.client - Discord client instance.
 * @param {Object} [context.interaction] - Discord interaction object if invoked via slash command.
 * @returns {Promise<string>} The generated AI text response.
 */
async function processAiChat({ prompt, user, member, guild, channel, client, interaction = null }) {
  const userId = user.id;
  const creatorInfo = await getCreatorInfo(client);
  const resolvedMentions = await resolveMentions(prompt, client);

  // Get tools available based on user permissions
  const tools = getToolDefinitions(member);

  const startTime = Date.now();
  const pInfo = await getEffectivePersonality(userId, guild?.id);

  const systemInstruction = await buildSystemInstruction({
    userId,
    guildId: guild?.id,
    creatorInfo,
    tools,
    resolvedMentions,
    pInfo,
  });

  // Persist user prompt to history
  await pushHistory(userId, 'user', prompt);

  const messages = [
    { role: 'system', content: systemInstruction },
    ...(await getHistory(userId)),
  ];

  // Tool execution interaction context
  const toolContext = interaction || {
    guild,
    member,
    user,
    client,
    channel,
    followUp: async (options) => {
      return await channel.send(options);
    },
  };

  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const apiMessage = await chatCompletion({
      messages,
      tools,
      maxTokens: USE_SHORT_RESPONSE ? 200 : 500,
    });

    if (apiMessage.tool_calls && apiMessage.tool_calls.length > 0) {
      messages.push({ role: 'assistant', content: apiMessage.content || null, tool_calls: apiMessage.tool_calls });

      for (const call of apiMessage.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch (err) {
          console.log('Failed to parse tool call arguments:', call.function.arguments);
        }

        // Permission & safety checks run inside runTool
        const result = await runTool(toolContext, call.function.name, args);

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      continue; // Feed results back to model
    }

    finalText = apiMessage.content || '';
    break;
  }

  if (!finalText) {
    finalText = "Sorry, I couldn't come up with an answer for that. 💦";
  }

  // Replace creator name with discord mention tag
  if (creatorInfo.name && creatorInfo.name !== creatorInfo.mention) {
    finalText = finalText.replace(new RegExp(escapeRegExp(creatorInfo.name), 'gi'), creatorInfo.mention);
  }

  // Persist assistant response to history
  await pushHistory(userId, 'assistant', finalText);

  const latency = Date.now() - startTime;

  return {
    text: finalText,
    personality: pInfo,
    latency,
    rawPrompt: prompt,
    toString() {
      return finalText;
    },
  };
}

module.exports = {
  processAiChat,
  getCreatorInfo,
  resolveMentions,
  buildSystemInstruction,
};
