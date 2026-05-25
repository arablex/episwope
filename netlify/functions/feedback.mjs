/**
 * POST /api/feedback   — quiet in-product feedback channel (cabinet footer).
 * Body: { message, email?, page? }
 * Emails the admin via Resend, with reply-to set to the user when provided.
 * Rate-limited per IP. No auth (low-stakes, optional).
 */
import { getStore }                 from '@netlify/blobs';
import { sendEmail }                from './_lib/resend.mjs';
import { rateLimitOk, ipFromReq }   from './_lib/rate-limit.mjs';

const CORS  = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const ADMIN = 'aleksey.stepikin@gmail.com';
const rlStore = () => getStore({ name: 'rate-limits', consistency: 'strong' });
const esc = (s) => String(s).replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      ...CORS, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  const ip = ipFromReq(req);
  if (!(await rateLimitOk({ key: `feedback:${ip}`, store: rlStore(), limit: 10 }))) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: CORS });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }

  const message = String(body.message || '').trim().slice(0, 4000);
  if (message.length < 3) {
    return new Response(JSON.stringify({ error: 'message_required' }), { status: 400, headers: CORS });
  }
  const from = String(body.email || '').trim().slice(0, 200);
  const page = String(body.page  || '').trim().slice(0, 60);

  try {
    await sendEmail({
      to: ADMIN,
      subject: `Vigilo feedback${from ? ` · ${from}` : ''}`,
      html: `<p><b>Page:</b> ${esc(page || '—')}<br><b>From:</b> ${esc(from || 'anonymous')}</p>`
          + `<p style="white-space:pre-wrap">${esc(message)}</p>`,
      text: `Page: ${page || '—'}\nFrom: ${from || 'anonymous'}\n\n${message}`,
      replyTo: isEmail(from) ? from : undefined,
    });
  } catch (e) {
    console.error('feedback send failed:', e.message);
    return new Response(JSON.stringify({ error: 'send_failed' }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
};

export const config = { path: '/api/feedback' };
