/**
 * POST /api/pro-briefing
 * Authorization: Bearer <EPISCOPE_TOKEN_SECRET>
 *
 * Body: { events: [...] }  — the full risk events array (same payload the
 *                            update-data workflow already builds for alert-check)
 *
 * Sends a personalised weekly risk briefing email to every PRO subscriber who
 * has watched countries. For each watched country we surface its top events
 * and generate ONE strict, headline-grounded AI analysis (cached per country
 * within the run so cost stays near zero). Free subscribers are skipped — the
 * delivered briefing is the core Pro value; the in-app analysis is the free hook.
 *
 * Triggered weekly by .github/workflows/pro-briefing.yml.
 * Returns { ok, eligible, sent }.
 *
 * Env: EPISCOPE_TOKEN_SECRET, JWT_SECRET (n/a here), one AI provider key, RESEND_API_KEY
 */
import { listAllVerified, putSubscriber } from './_lib/blobs.mjs';
import { sendEmail }                      from './_lib/resend.mjs';
import { isPaidActive }                   from './_lib/paid.mjs';
import { buildAnalysisPrompt, runAnalysis, activeProvider } from './_lib/ai.mjs';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const SEV_RANK = { minimal:0, monitoring:0, low:1, moderate:2, warning:2,
                   elevated:3, alert:3, severe:4, critical:5, catastrophic:6 };
function rank(s){
  if (typeof s === 'number') return s;
  const n = Number(s);
  if (String(s ?? '').trim() !== '' && !Number.isNaN(n)) return n;
  return SEV_RANK[String(s || '').toLowerCase()] ?? 0;
}

const _esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }
  const secret = process.env.EPISCOPE_TOKEN_SECRET;
  const auth   = req.headers.get('authorization') || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }
  if (!activeProvider()) {
    return new Response(JSON.stringify({ error: 'ai_not_configured' }), { status: 503, headers: CORS });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }
  const events = Array.isArray(body.events) ? body.events : [];

  // Index events by country (ISO and name) for quick per-subscriber lookup
  const byCountry = new Map();
  const add = (key, ev) => {
    if (!key) return;
    const k = String(key).toLowerCase();
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k).push(ev);
  };
  for (const ev of events) {
    add(ev.country, ev);
    if (ev.geo?.country) add(ev.geo.country, ev);
  }

  // Per-country AI analysis cache — generate at most once per country per run
  const analysisCache = new Map();
  async function analyseCountry(iso, lang) {
    const ck = `${iso}_${lang}`;
    if (analysisCache.has(ck)) return analysisCache.get(ck);
    const evs = (byCountry.get(String(iso).toLowerCase()) || [])
      .sort((a, b) => rank(b.severity) - rank(a.severity)).slice(0, 8);
    if (!evs.length) { analysisCache.set(ck, null); return null; }
    const headlines = evs.map(e => e.headline).filter(Boolean);
    const prompt = buildAnalysisPrompt({
      country: iso, delta: 0, topThreat: evs[0]?.type, category: evs[0]?.category,
      headlines, lang, sentences: 4,
    });
    let summary = null;
    try { summary = await runAnalysis(prompt, { maxTokens: 260 }); }
    catch (e) { console.error('pro-briefing analyse error', iso, e.message); }
    const result = summary ? { summary, events: evs } : null;
    analysisCache.set(ck, result);
    return result;
  }

  const subs = await listAllVerified();
  let eligible = 0, sent = 0;

  for (const sub of subs) {
    // PRO only, with watched countries, briefing not turned off
    const isPro = sub.plan === 'pro' && isPaidActive(sub.paid_until);
    if (!isPro) continue;
    if (!sub.countries || sub.countries.length === 0) continue;
    const cfg = sub.alerts || {};
    if (cfg.digest === 'off') continue;
    eligible++;

    const lang = sub.lang || 'en';
    // Build per-country sections (cap to first 10 countries to bound cost)
    const sections = [];
    for (const iso of sub.countries.slice(0, 10)) {
      const a = await analyseCountry(iso, lang);
      if (a) sections.push({ iso, ...a });
    }
    if (sections.length === 0) continue;

    const { subject, html, text } = renderBriefingEmail({ sections, lang });
    try {
      const origin = new URL(req.url).origin;
      const listUnsubscribeUrl = sub.unsubToken ? `${origin}/api/unsubscribe?t=${sub.unsubToken}` : undefined;
      await sendEmail({ to: sub.email, subject, html, text, listUnsubscribeUrl });
      sent++;
      await putSubscriber(sub.__key, { ...sub, last_briefing_at: new Date().toISOString() });
    } catch (e) {
      console.error(`pro-briefing: failed for ${sub.email}:`, e.message);
    }
  }

  console.log(`pro-briefing: eligible=${eligible} sent=${sent}`);
  return new Response(JSON.stringify({ ok: true, eligible, sent }), { status: 200, headers: CORS });
};

function renderBriefingEmail({ sections, lang }) {
  const ru = lang === 'ru';
  const subject = ru ? 'Vigilo — еженедельный брифинг по вашим странам'
                     : 'Vigilo — your weekly country briefing';
  const intro = ru
    ? 'Краткая сводка по странам из вашего списка. Анализ построен строго на заголовках источников.'
    : 'A short briefing for your watched countries. Analysis is grounded strictly in source headlines.';

  const blocks = sections.map(s => {
    const evList = (s.events || []).slice(0, 3).map(e => {
      const date = (e.first_seen || '').slice(5, 10);
      return `<li style="margin:2px 0;color:#3B3A36;font-size:13px">${_esc(e.headline)} <span style="color:#9C9A92">${date}</span></li>`;
    }).join('');
    return `<div style="margin:0 0 22px">
      <div style="font-size:15px;font-weight:700;color:#0F0E0C;margin-bottom:6px">${_esc(s.iso)}</div>
      <div style="font-size:13.5px;line-height:1.6;color:#3B3A36;margin-bottom:8px">${_esc(s.summary)}</div>
      <ul style="margin:0;padding-left:18px">${evList}</ul>
    </div>`;
  }).join('');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <div style="font-size:20px;font-weight:800;color:#E8590C;margin-bottom:4px">Vigilo</div>
    <div style="font-size:13px;color:#807E76;margin-bottom:20px">${intro}</div>
    ${blocks}
    <div style="font-size:11px;color:#9C9A92;border-top:1px solid #ECEAE2;padding-top:12px;margin-top:8px">
      ${ru ? 'Источники: WHO · GDELT · Google News. Не является официальной рекомендацией.'
           : 'Sources: WHO · GDELT · Google News. Not official advice.'}
    </div>
  </div>`;

  const text = sections.map(s =>
    `${s.iso}\n${s.summary}\n` + (s.events || []).slice(0,3).map(e => `- ${e.headline}`).join('\n')
  ).join('\n\n');

  return { subject, html, text };
}

export const config = { path: '/api/pro-briefing' };
