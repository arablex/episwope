// netlify/functions/_lib/resend.mjs

const RESEND_URL = 'https://api.resend.com/emails';

/** Send a transactional email through Resend.
 *  Throws on non-2xx. Caller decides whether to swallow or surface. */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const body = {
    from: 'EpiScope <noreply@episwope.ru>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return res.json(); // { id: 're_xxx' }
}
