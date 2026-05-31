/**
 * POST /api/ai-brief
 *
 * Generates a 3-sentence AI narrative for a Brief view insight card.
 * Caches per (iso + date) for 12h in Netlify Blobs so repeated views
 * are free.
 *
 * Provider is chosen by which env var is set, in priority order:
 *   1. DEEPSEEK_API_KEY → DeepSeek (deepseek-chat, OpenAI-compatible)
 *   2. GEMINI_API_KEY   → Gemini 2.0 Flash (free tier, 1500 req/day)
 *   3. ANTHROPIC_API_KEY → Claude Haiku (paid fallback)
 *
 * Body:
 *   {
 *     iso: "LB",
 *     country: "Lebanon",
 *     category: "conflict",
 *     delta: 3.0,
 *     topThreat: "kinetic_strike",
 *     headlines: ["Israeli Army Orders Evacuation...", ...],  // up to 5
 *     sparkline: [0, 0, 3.84, 2.86, 2.81, 3.04],
 *     dates: ["05-23", ..., "05-31"],
 *     breakdown: [{ cat: "Conflict", score: 2.7, events: 8 }]
 *   }
 *
 * Returns: { summary: "...", cached: bool, provider: "..." }
 */

import { getStore } from '@netlify/blobs';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: CORS });

  const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY;
  const GEMINI_KEY    = process.env.GEMINI_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const provider = DEEPSEEK_KEY ? 'deepseek'
                 : GEMINI_KEY   ? 'gemini'
                 : ANTHROPIC_KEY ? 'claude'
                 : null;
  if (!provider) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 503, headers: CORS });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  const { iso, country, category, delta, topThreat, headlines = [], sparkline = [], dates = [], breakdown = [] } = body;
  if (!iso || !country) {
    return new Response(JSON.stringify({ error: 'iso and country required' }), { status: 400, headers: CORS });
  }

  // ── Cache check ────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `brief-${iso}-${today}`;
  let store;
  try {
    store = getStore({ name: 'ai-briefs', consistency: 'eventual' });
    const cached = await store.get(cacheKey, { type: 'json' });
    if (cached && cached.summary) {
      return new Response(JSON.stringify({ summary: cached.summary, cached: true }), { headers: CORS });
    }
  } catch { /* cache miss — proceed */ }

  // ── Build prompt ───────────────────────────────────────────────────────
  const trendDir = sparkline.length >= 2
    ? (sparkline[sparkline.length - 1] > sparkline[0] ? 'rising' : 'declining')
    : 'elevated';

  const hlBlock = headlines.slice(0, 4).map((h, i) => `${i + 1}. ${h}`).join('\n');
  const bdBlock = breakdown.map(b => `${b.cat}: score ${b.score} (${b.events} events)`).join(', ');

  const prompt = `You are a concise risk intelligence analyst. Write exactly 3 sentences explaining what is happening in ${country} right now and why it matters for travelers and aid workers.

Context:
- Risk score jumped +${delta} this week (${trendDir})
- Primary threat: ${topThreat || category}
- Breakdown: ${bdBlock || 'N/A'}
- Recent headlines:
${hlBlock || '(no headlines available)'}

Rules:
- 3 sentences only, no bullet points, no headers
- Be specific: name the actors, locations, and actions when available from the headlines
- End with one sentence on what this means for people on the ground
- Do not start with "I" or "Based on"
- Plain prose, no markdown`;

  // ── Call the selected provider ─────────────────────────────────────────
  let summary;
  try {
    if (provider === 'deepseek') {
      summary = await callOpenAICompat(
        'https://api.deepseek.com/chat/completions',
        DEEPSEEK_KEY, 'deepseek-chat', prompt);
    } else if (provider === 'gemini') {
      summary = await callGemini(GEMINI_KEY, prompt);
    } else {
      summary = await callClaude(ANTHROPIC_KEY, prompt);
    }
    if (!summary) throw new Error('Empty response');
  } catch (e) {
    console.error(`ai-brief ${provider} error:`, e);
    return new Response(JSON.stringify({ error: 'AI unavailable' }), { status: 502, headers: CORS });
  }

  // ── Cache result ───────────────────────────────────────────────────────
  try {
    await store.setJSON(cacheKey, { summary, provider, generated_at: new Date().toISOString() });
  } catch { /* cache write optional */ }

  return new Response(JSON.stringify({ summary, cached: false, provider }), { headers: CORS });
};

// ── Provider adapters ──────────────────────────────────────────────────────

// DeepSeek + any OpenAI-compatible chat endpoint
async function callOpenAICompat(url, key, model, prompt) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 220,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim();
}

// Google Gemini 2.0 Flash — free tier
async function callGemini(key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 220, temperature: 0.4 },
    }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

// Anthropic Claude Haiku — paid fallback
async function callClaude(key, prompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.content?.[0]?.text?.trim();
}

export const config = { path: '/api/ai-brief' };
