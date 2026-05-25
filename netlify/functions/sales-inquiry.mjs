/**
 * POST /api/sales-inquiry  — B2B "get started / talk to us" form (pricing page).
 * Replaces fragile mailto: links. Body: { plan, org, email, seats?, region?, message? }
 * Emails the admin via Resend, reply-to the work email. Rate-limited per IP.
 */
import { getStore }               from '@netlify/blobs';
import { sendEmail }              from './_lib/resend.mjs';
import { rateLimitOk, ipFromReq } from './_lib/rate-limit.mjs';

const CORS  = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const ADMIN = 'aleksey.stepikin@gmail.com';
const rlStore = () => getStore({ name: 'rate-limits', consistency: 'strong' });
const esc = (s) => String(s).replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const clip = (s, n) => String(s || '').trim().slice(0, n);

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      ...CORS, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  const ip = ipFromReq(req);
  if (!(await rateLimitOk({ key: `sales:${ip}`, store: rlStore(), limit: 15 }))) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: CORS });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }

  const email = clip(body.email, 200);
  const org   = clip(body.org, 200);
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ error: 'valid_email_required' }), { status: 400, headers: CORS });
  }
  const plan    = clip(body.plan, 40)    || 'unspecified';
  const seats   = clip(body.seats, 40);
  const region  = clip(body.region, 200);
  const message = clip(body.message, 4000);

  try {
    await sendEmail({
      to: ADMIN,
      subject: `Vigilo ${plan} inquiry — ${org || email}`,
      html: `<p><b>Plan:</b> ${esc(plan)}<br><b>Org:</b> ${esc(org || '—')}<br>`
          + `<b>Work email:</b> ${esc(email)}<br><b>Seats:</b> ${esc(seats || '—')}<br>`
          + `<b>Region:</b> ${esc(region || '—')}</p>`
          + (message ? `<p style="white-space:pre-wrap">${esc(message)}</p>` : ''),
      text: `Plan: ${plan}\nOrg: ${org || '—'}\nWork email: ${email}\nSeats: ${seats || '—'}\n`
          + `Region: ${region || '—'}\n\n${message || ''}`,
      replyTo: email,
    });
  } catch (e) {
    console.error('sales-inquiry send failed:', e.message);
    return new Response(JSON.stringify({ error: 'send_failed' }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
};

export const config = { path: '/api/sales-inquiry' };
