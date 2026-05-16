// netlify/functions/_lib/resend.mjs

const RESEND_URL = 'https://api.resend.com/emails';

/** Send a transactional email through Resend.
 *  Throws on non-2xx. Caller decides whether to swallow or surface.
 *
 *  Deliverability:
 *   - default Reply-To: hello@vigilo.cc (legitimate reply address)
 *   - listUnsubscribeUrl → adds RFC 8058 one-click List-Unsubscribe headers
 *     (the single strongest Gmail/Yahoo bulk-sender trust signal)
 *   - extra `headers` are merged last (caller can override)
 */
export async function sendEmail({ to, subject, html, text, replyTo, listUnsubscribeUrl, headers }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const mailHeaders = {};
  if (listUnsubscribeUrl) {
    mailHeaders['List-Unsubscribe'] = `<${listUnsubscribeUrl}>`;
    mailHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  Object.assign(mailHeaders, headers || {});

  const body = {
    from: 'Vigilo <noreply@vigilo.cc>',
    to: Array.isArray(to) ? to : [to],
    reply_to: replyTo || 'hello@vigilo.cc',
    subject,
    html,
    text,
  };
  if (Object.keys(mailHeaders).length) body.headers = mailHeaders;

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
