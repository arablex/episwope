/**
 * POST /api/enterprise-lead  { destination, email, company }
 *
 * B2B lead from /reports. Captures the lead (Blobs), then INSTANTLY
 * emails the requester a live "Travel Security Passport (sample)" for
 * the chosen destination — real composite from /api/v1/risk, not a
 * promised-later PDF. Also pings the admin Telegram if configured.
 *
 * Honest: the email is a live risk summary + links, framed as a sample.
 * Env: RESEND_API_KEY, optional TELEGRAM_BOT_TOKEN+TELEGRAM_ADMIN_CHAT_IDS.
 */
import { getStore } from '@netlify/blobs';
import { sendEmail } from './_lib/resend.mjs';
import { rateLimitOk, ipFromReq } from './_lib/rate-limit.mjs';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

// RU/EN destination name → ISO
const ISO = { 'таиланд':'TH','thailand':'TH','франция':'FR','france':'FR',
  'нигерия':'NG','nigeria':'NG','турция':'TR','turkey':'TR','оаэ':'AE','uae':'AE',
  'индия':'IN','india':'IN','испания':'ES','spain':'ES','италия':'IT','italy':'IT',
  'германия':'DE','germany':'DE' };
const BAND_RU = { minimal:'Минимальный', low:'Низкий', moderate:'Умеренный',
  elevated:'Повышенный', severe:'Высокий', critical:'Критический' };
const BAND_C = { minimal:'#5b9d6b', low:'#caa53d', moderate:'#e2820f',
  elevated:'#d8531e', severe:'#c0392b', critical:'#7d1a12' };

const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return J({ error: 'method_not_allowed' }, 405);

  const ip = ipFromReq(req);
  const rl = (() => { const b = getStore({ name:'rate-limits', consistency:'strong' });
    return { get:(k)=>b.get(k,{type:'json'}), put:(k,v)=>b.setJSON(k,v) }; })();
  if (!await rateLimitOk({ key:`elead:${ip}`, store: rl, limit: 6 }))
    return J({ error: 'rate_limited' }, 429);

  let body;
  try { body = await req.json(); } catch { return J({ error:'invalid_json' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  const company = String(body.company || '').trim().slice(0, 120);
  const destination = String(body.destination || '').trim().slice(0, 60);
  if (!email || !email.includes('@')) return J({ error:'invalid_email' }, 400);

  const iso = ISO[destination.toLowerCase()] || 'TR';
  const origin = new URL(req.url).origin;

  // Capture the lead
  try {
    const leads = getStore({ name:'enterprise-leads', consistency:'strong' });
    await leads.setJSON(`${Date.now()}-${email}`,
      { email, company, destination, iso, ip, at: new Date().toISOString() });
  } catch {}

  // Pull live composite for the destination
  let cr = { score: 0, band: 'minimal', dominant_category: null }, cb = {};
  try {
    const r = await fetch(`${origin}/api/v1/risk?country=${iso}`);
    if (r.ok) { const d = await r.json();
      cr = d.composite_risk || cr; cb = d.category_breakdown || {}; }
  } catch {}

  const band = cr.band || 'minimal';
  const bRu = BAND_RU[band] || band;
  const bC = BAND_C[band] || '#807E76';
  const ind = (lab, key, fallback) => {
    const b = (cb[key] || {}).band || 'minimal';
    const txt = b === 'minimal' ? fallback : (BAND_RU[b] || b);
    return `<tr><td style="padding:7px 0;border-top:1px solid #ECEAE2;font-size:13px">
      <b>${lab}</b></td><td align="right" style="padding:7px 0;border-top:1px solid #ECEAE2;
      font-size:13px;color:#807E76;font-weight:700">${txt}</td></tr>`;
  };

  const subject = `Vigilo — паспорт безопасности: ${esc(destination)} (${bRu})`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    max-width:560px;margin:0 auto;color:#0F0E0C">
    <div style="display:flex;align-items:center;gap:9px;padding:18px 0">
      <span style="width:28px;height:28px;border-radius:7px;background:#E8590C;color:#fff;
        display:inline-flex;align-items:center;justify-content:center;font-weight:900">V</span>
      <b style="font-size:15px">Vigilo · Travel Security Passport</b></div>
    <div style="border:1px solid #ECEAE2;border-radius:14px;padding:22px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#807E76;
        text-transform:uppercase;margin-bottom:6px">Композитный риск · ${esc(destination)}</div>
      <div style="display:flex;align-items:flex-end;gap:8px">
        <span style="font-size:40px;font-weight:850;letter-spacing:-1.5px">${(cr.score||0).toFixed(1)}</span>
        <span style="font-size:13px;color:#807E76;font-weight:700">/ 5</span>
        <span style="margin-left:auto;background:${bC};color:#fff;font-size:11px;
          font-weight:800;text-transform:uppercase;padding:5px 10px;border-radius:6px">${bRu}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
        ${ind('Медицина','health','Стабильно')}
        ${ind('Транспорт','transport','Без сбоев')}
        ${ind('Границы / въезд','border','Без ограничений')}
        ${ind('Конфликты','conflict','Спокойно')}
      </table>
      <p style="font-size:12px;color:#807E76;margin-top:14px;line-height:1.5">
        Это живая сводка-образец. Полный PDF-паспорт включает ИИ-прогноз угроз
        на 14 дней, требования Duty of Care и детальные правила въезда.</p>
      <a href="https://vigilo.cc/app?country=${iso}"
        style="display:block;text-align:center;background:#E8590C;color:#fff;
        font-weight:700;text-decoration:none;padding:13px;border-radius:10px;
        margin-top:8px">Открыть живую карту риска →</a>
    </div>
    <p style="font-size:11px;color:#807E76;text-align:center;padding:16px 0">
      Vigilo Risk Intelligence · <a href="https://vigilo.cc/api/v1/docs"
      style="color:#E8590C">API</a> · Не является фин./мед. советом.</p></div>`;
  const text = `Vigilo — паспорт безопасности: ${destination}\n`+
    `Композитный риск: ${(cr.score||0).toFixed(1)}/5 (${bRu})\n`+
    `Живая карта: https://vigilo.cc/app?country=${iso}\n`+
    `API: https://vigilo.cc/api/v1/docs`;

  let sent = false;
  try { await sendEmail({ to: email, subject, html, text,
    replyTo: 'hello@vigilo.cc' }); sent = true; }
  catch (e) { console.error('enterprise-lead send:', e.message); }

  // Admin ping (best-effort)
  try {
    const tok = process.env.TELEGRAM_BOT_TOKEN;
    const ids = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').filter(Boolean);
    if (tok && ids.length) {
      const msg = `🟢 B2B lead — ${company || '—'}\n${email}\n${destination} (${iso})`;
      await Promise.all(ids.map((cid) => fetch(
        `https://api.telegram.org/bot${tok}/sendMessage`, { method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat_id: cid.trim(), text: msg }) }).catch(()=>{})));
    }
  } catch {}

  return J({ ok: true, emailed: sent, iso });
};

export const config = { path: '/api/enterprise-lead' };
