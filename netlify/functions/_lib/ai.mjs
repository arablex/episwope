// netlify/functions/_lib/ai.mjs
// Shared AI provider router + risk-analysis prompt builder.
// Used by ai-brief.mjs (in-app, free hook) and pro-briefing.mjs (Pro email).
//
// Provider is chosen by which env var is set, in priority order:
//   1. DEEPSEEK_API_KEY  → deepseek-chat (OpenAI-compatible)
//   2. GEMINI_API_KEY    → gemini-2.0-flash (FREE tier)
//   3. ANTHROPIC_API_KEY → claude-haiku-4-5 (paid fallback)

export function activeProvider() {
  if (process.env.DEEPSEEK_API_KEY)  return 'deepseek';
  if (process.env.GEMINI_API_KEY)    return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

/**
 * Build a strict, anti-hallucination risk-analysis prompt.
 * Facts may ONLY come from the provided headlines.
 */
export function buildAnalysisPrompt({ country, delta, topThreat, category,
                                      breakdown = [], headlines = [],
                                      sparkline = [], lang = 'en',
                                      sentences = 3 }) {
  const trendDir = sparkline.length >= 2
    ? (sparkline[sparkline.length - 1] > sparkline[0] ? 'rising' : 'declining')
    : 'elevated';
  const hlBlock = headlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n');
  const bdBlock = breakdown.map(b => `${b.cat}: score ${b.score} (${b.events} events)`).join(', ');
  const isRu = lang === 'ru';
  const langRule    = isRu ? 'Write the analysis in RUSSIAN.' : 'Write the analysis in ENGLISH.';
  const noDataPhrase = isRu ? 'причины не отражены в источниках' : 'causes not shown in the sources';

  return `You are a precise risk intelligence analyst. Write at most ${sentences} sentences about ${country} based STRICTLY on the headlines listed below. ${langRule}

HARD RULES — follow exactly:
- Use ONLY facts that appear verbatim in the headlines. Do NOT add background, history, or context from your own knowledge.
- If the headlines do not state the CAUSE or reason for the situation, explicitly say so (e.g. "${noDataPhrase}"). Never invent a cause.
- Do not name actors, dates, casualty figures, or locations unless they appear in a headline.
- If the headlines are too sparse, write fewer sentences and state that the data is limited.
- No bullet points, no headers, no markdown. Do not start with "I" or "Based on".

Signal metadata (for framing only, NOT facts to assert):
- Risk score change: +${delta} this week (${trendDir})
- Primary threat tag: ${topThreat || category || 'n/a'}
- Category breakdown: ${bdBlock || 'N/A'}

Headlines (the ONLY allowed source of facts):
${hlBlock || '(no headlines available — say that no source material is available)'}`;
}

/** Run the prompt through the active provider. Returns trimmed text or throws. */
export async function runAnalysis(prompt, { maxTokens = 220 } = {}) {
  const provider = activeProvider();
  if (!provider) throw new Error('No AI provider configured');
  if (provider === 'deepseek') {
    return callOpenAICompat('https://api.deepseek.com/chat/completions',
      process.env.DEEPSEEK_API_KEY, 'deepseek-chat', prompt, maxTokens);
  }
  if (provider === 'gemini') {
    return callGemini(process.env.GEMINI_API_KEY, prompt, maxTokens);
  }
  return callClaude(process.env.ANTHROPIC_API_KEY, prompt, maxTokens);
}

async function callOpenAICompat(url, key, model, prompt, maxTokens) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.4,
      messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callGemini(key, prompt, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 } }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

async function callClaude(key, prompt, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key,
      'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.content?.[0]?.text?.trim();
}
