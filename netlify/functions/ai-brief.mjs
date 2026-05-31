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
import { activeProvider, buildAnalysisPrompt, runAnalysis } from './_lib/ai.mjs';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: CORS });

  const provider = activeProvider();
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
  const _lang = (body.lang === 'ru') ? 'ru' : 'en';
  const cacheKey = `brief-${iso}-${_lang}-${today}`;
  let store;
  try {
    store = getStore({ name: 'ai-briefs', consistency: 'eventual' });
    const cached = await store.get(cacheKey, { type: 'json' });
    if (cached && cached.summary) {
      return new Response(JSON.stringify({ summary: cached.summary, cached: true }), { headers: CORS });
    }
  } catch { /* cache miss — proceed */ }

  // ── Build prompt + call provider via shared lib ─────────────────────────
  const prompt = buildAnalysisPrompt({
    country, delta, topThreat, category, breakdown, headlines, sparkline,
    lang: _lang, sentences: 3,
  });

  let summary;
  try {
    summary = await runAnalysis(prompt, { maxTokens: 220 });
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

export const config = { path: '/api/ai-brief' };
