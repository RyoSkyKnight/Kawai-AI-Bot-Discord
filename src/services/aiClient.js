const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Send a chat completion request to OpenRouter.
 * Returns the raw assistant message object (content + optional tool_calls)
 * so the caller can handle multi-turn tool-calling loops.
 */
async function chatCompletion({ messages, tools, maxTokens = 1000, temperature = 0.7 }) {
  const body = {
    model: OPENROUTER_MODEL,
    max_tokens: maxTokens,
    temperature,
    messages,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // Opsional tapi disarankan OpenRouter buat identifikasi app kamu
      'HTTP-Referer': process.env.APP_URL || 'https://discord.com',
      'X-Title': 'Cutie Discord Bot',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error(`No response returned from OpenRouter. Full response: ${JSON.stringify(data)}`);
  }

  if (choice.finish_reason === 'content_filter') {
    throw new Error('Response was blocked due to safety concerns.');
  }

  return choice.message; // { role: 'assistant', content, tool_calls? }
}

module.exports = { chatCompletion };
