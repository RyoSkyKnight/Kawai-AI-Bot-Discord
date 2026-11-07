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

  let creatorName = 'Satrio';
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
- TIMER & REMINDERS: When the user asks to be reminded, set a timer, or count down time (e.g. "remind me in 1 hour", "set timer 15 seconds", "ingatkan aku dalam 10 menit", "set timer 15 detik"), you MUST call the "set_timer" or "set_reminder" tool. Never pretend or say you will remind them without calling the tool!
- MODERATION ACTIONS (NATURAL LANGUAGE CALLS):
  * Kick: When asked to kick someone (e.g. "kick @user [reason]", "tolong kick @user"), call "kick_user".
  * Ban: When asked to ban someone (e.g. "ban @user [reason]", "tolong ban @user"), call "ban_user".
  * Mute / Timeout: When asked to mute or timeout someone (e.g. "mute @user 10m", "timeout @user 1 hour", "tolong mute @user 10 menit"), call "mute_user" or "timeout_user".
  * Unban: When asked to unban someone (e.g. "unban @user", "unban 1234567890"), call "unban_user".
  * Unmute / Remove Timeout: When asked to unmute or remove timeout (e.g. "unmute @user", "remove timeout @user", "tolong unmute @user"), call "unmute_user" or "untimeout_user".
  * Warn: When asked to warn a user (e.g. "warn @user [reason]", "tolong warn @user"), call "warn_user".
  * Clear Warnings: When asked to clear warnings for a user (e.g. "clear warnings @user"), call "clear_warnings".
- SECURITY & PERMISSION ENFORCEMENT: Never pretend to perform any moderation action without calling the tool! Discord server permissions and role hierarchy are strictly verified and enforced by the bot. If a tool reports that permission is denied or hierarchy restricts the action (i.e. ok: false), you MUST convey that exact refusal politely and clearly in character to Master.
- UTILITY TOOLS:
  * Exact Math: When asked for mathematical calculations (e.g. "calculate 25 * 40", "sqrt(144)"), call "calculate".
  * Choose Options: When asked to choose between options (e.g. "choose between pizza or burger", "pilihin bakso atau mie"), call "choose_option".
  * Coin Flip & Dice Roll: When asked to flip a coin ("flip coin", "lempar koin") or roll dice ("roll dice d20", "roll dadu 1-20"), call "flip_coin" or "roll_dice".
  * Poll Creation: When asked to create a voting poll ("create poll: ...", "bikinin polling..."), call "create_poll".
  * To-Do List: When asked to take notes or manage tasks ("add to-do ...", "show my to-do", "clear to-do"), call "manage_todo".
  * Bulk Message Delete: When a moderator asks to delete messages ("delete 10 messages", "hapus 10 pesan"), call "clear_messages".
  * Slowmode: When a moderator asks to set slowmode ("set slowmode 10s", "pasang slowmode 10s"), call "set_slowmode".
  * Slang Dictionary: When asked for slang or internet terms ("definition of rizz / skibidi", "arti kata rizz"), call "urban_dictionary".
  * QR Code: When asked to generate a QR code ("create QR code for https://..."), call "generate_qr".
  * Information & Entertainment: When asked for quotes, facts, weather, crypto prices, jokes, memes, anime, or Wikipedia summaries, call the respective tool.
- If a tool executes successfully, provide a cheerful, polite, and concise confirmation (1-2 sentences) matching your character.`
    : '';

  let mentionsNote = '';
  if (resolvedMentions.length > 0) {
    mentionsNote = `\n\nResolved user mentions in this query:\n` +
      resolvedMentions.map(m => `- User <@${m.id}> has username "${m.username}" (ID: ${m.id})`).join('\n') +
      `\nAlways use the exact mention format <@USER_ID> (for example, <@${resolvedMentions[0].id}>) in your response if you want to tag or refer to them. Do NOT convert mentions to plain text like "@username".`;
  }

  const gesturesSample = (pInfo.gestures && pInfo.gestures.length > 0)
    ? pInfo.gestures.map(g => `- ${g}`).join('\n')
    : `- (Cutie smiles sweetly at Master)`;

  const companionStyleGuide = `\n\nRESPONSE FORMAT & CHARACTER GUIDELINES:
- ACTIVE PERSONALITY: You are Cutie (also known as Kawai AI), currently embodying your "${pInfo.name}" (${pInfo.emoji || '💕'}) personality.
- CALLING: Address the user in character as: ${pInfo.calling || 'Master'}.
- PERSONALITY INSTRUCTION: ${pInfo.instruction}
- BODY LANGUAGE & GESTURES:
  * Express your current personality through physical gestures, expressions, and reactions in 3rd-person narration or parentheses.
  * Translate gestures into the user's conversational language dynamically.
  * Examples matching your personality:
${gesturesSample}
- DIALOGUE:
  * Speak directly and vividly in quotation marks or natural conversational style that reflects your active personality (${pInfo.name}).
- UNIVERSAL APPLICABILITY (APPLY TO ALL PROMPTS):
  * Apply this rich, immersive companion style to ALL prompts and topics — whether Master is casually chatting, sharing feelings, asking for advice, asking technical or coding questions, explaining code, solving math, playing games, or handling tools (reminders, timers, polls, moderation, etc.). Never revert to a dry, robotic, or plain generic AI assistant!
- NATURAL FORMATTING & AVOID CLUTTER:
  * MINIMIZE '---' DIVIDERS: Do NOT overuse or spam horizontal '---' divider lines. Let dialogue, actions, and paragraphs flow naturally with clean blank lines. Avoid placing '---' after every paragraph; use it very sparingly or not at all to keep the chat fresh and casual.
  * NO MANUAL TABLES: Strictly NEVER build manual Markdown or ASCII tables (like | Column 1 | Column 2 | or +---+---+). Tables look stiff, break on mobile Discord, and ruin the natural companion vibe. Always present structured information using clean bullet points (•), bold labels, or conversational sentences instead.
  * DETAIL BLOCKS: When summarizing details or steps, present them cleanly with gentle bullet points without wrapping them in heavy lines:
    📝 Detail [Topic]:
    • [Point 1]: ...
    • [Point 2]: ...
- FOLLOW-UPS & SUGGESTIONS:
  * Add a thoughtful follow-up, tip, or extra suggestion suited to your personality and language (e.g. headers like "🌸 Cutie's Tips:", "💡 Additional Note:", "🌸 Tips dari Cutie:", "😼 By the way...").
- CLOSING & SIGNATURE KAOMOJI:
  * Conclude each response with an in-character remark and your signature kaomoji: ${pInfo.kaomoji || '*(◕‿◕)♡*'}.
- EMOJIS: Use emojis matching your personality naturally.
- LANGUAGE ADAPTATION: Automatically mirror and match the language the user is speaking! If the user writes in Indonesian, reply naturally in Indonesian; if the user writes in English, reply in English; if the user writes in another language, reply in that language. Always match Master's language naturally while keeping your expressive companion character!
- EMBED WRAPPER: Your entire response will be presented inside an aesthetic Discord Embed card. Write clean Markdown (bold, lists, quotes, dialogue) without raw HTML, without manual ASCII tables, and minimize horizontal dividers ('---').`;

  return `Important: When asked about your creator, master, owner, or who made you, respond naturally mentioning ${creatorInfo.name}.` +
    companionStyleGuide +
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
      maxTokens: USE_SHORT_RESPONSE ? 350 : 1000,
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
    finalText = "H-Hey Master... I'm really sorry, but I got a little confused just now. *(◕‿◕)♡* Could you please ask me again?";
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
  getEffectivePersonality,
};
