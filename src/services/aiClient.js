require('dotenv').config();

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Send a chat completion request to OpenRouter.
 * Returns the raw assistant message object (content + optional tool_calls)
 * so the caller can handle multi-turn tool-calling loops.
 */
async function chatCompletion({ messages, tools, maxTokens = 1000, temperature = 0.7 }) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let choice; // will be set after successful request
  let data; // response payload
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  let attempt = 0;
  let res;

  while (attempt < MAX_RETRIES) {
    try {
      res = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://discord.com',
          'X-Title': 'Cutie Discord Bot',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        // Retry on rate limit or overload status codes
        if (res.status === 429 || errText.toLowerCase().includes('overload')) {
          attempt++;
          console.warn(`OpenRouter request overload (status ${res.status}), retry ${attempt}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }
        throw new Error(`OpenRouter error ${res.status}: ${errText}`);
      }

      data = await res.json();
      if (data.error) {
        // Retry on overload errors reported in payload
        if (data.error.message && data.error.message.toLowerCase().includes('overload')) {
          attempt++;
          console.warn(`OpenRouter payload overload error, retry ${attempt}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }
        throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      choice = data.choices?.[0];
      if (!choice) {
        throw new Error(`No response returned from OpenRouter. Full response: ${JSON.stringify(data)}`);
      }
      // Successful response, break loop
      break;
    } catch (err) {
      if (attempt >= MAX_RETRIES - 1) {
        throw err;
      }
      attempt++;
      console.warn(`OpenRouter request failed (${err.message}), retry ${attempt}/${MAX_RETRIES}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }

  if (!choice) {
    throw new Error(`No response returned from OpenRouter. Full response: ${JSON.stringify(data)}`);
  }

  // Handle reasoning/thinking models where text might be in reasoning field
  if (choice.message && !choice.message.content && choice.message.reasoning) {
    choice.message.content = choice.message.reasoning;
  }

  // Ensure the response contains content or tool calls; throw error if empty so caller fallback is triggered
  if (!choice.message || (!choice.message.content && (!choice.message.tool_calls || choice.message.tool_calls.length === 0))) {
    throw new Error('OpenRouter response contains empty content and no tool calls.');
  }

  return choice.message; // { role: 'assistant', content, tool_calls? }
}

module.exports = { chatCompletion };
