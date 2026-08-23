const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function generateReply({ systemInstruction, prompt, maxTokens, temperature = 0.7 }) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // Opsional tapi disarankan OpenRouter buat identifikasi app kamu
      'HTTP-Referer': process.env.APP_URL || 'https://discord.com',
      'X-Title': 'Cutie Discord Bot',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === 'content_filter') {
    throw new Error('Response was blocked due to safety concerns.');
  }

  return choice?.message?.content ?? '';
}

module.exports = { generateReply };