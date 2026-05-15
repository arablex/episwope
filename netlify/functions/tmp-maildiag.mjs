// TEMPORARY self-diagnostic — remove after debugging Resend.
// Gated by an unguessable path secret. Does a real Resend send and
// returns the exact Resend status/body so we can see why mail fails.

const SECRET = '54c4e5af18ce791ddd87047f';

const J = (o, s = 200) =>
  new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('s') !== SECRET) {
    return new Response('not found', { status: 404 });
  }

  const key = process.env.RESEND_API_KEY || '';
  const env = {
    RESEND_API_KEY_set: !!key,
    RESEND_API_KEY_len: key.length,
    RESEND_API_KEY_prefix: key ? key.slice(0, 3) : null,
    JWT_SECRET_set: !!process.env.JWT_SECRET,
  };
  if (!key) return J({ ok: false, env, error: 'RESEND_API_KEY missing in Netlify env' });

  const to = url.searchParams.get('to') || 'aleksey.stepikin@gmail.com';

  let status = null, body = null, threw = null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'EpiScope <noreply@episcope.ru>',
        to: [to],
        subject: 'EpiScope test',
        html: '<p>EpiScope mail test — if you see this, sending works.</p>',
        text: 'EpiScope mail test',
      }),
    });
    status = res.status;
    body = await res.text();
  } catch (e) {
    threw = e.message;
  }

  return J({
    ok: status >= 200 && status < 300,
    env,
    resend: { status, body, exception: threw },
  });
};

export const config = { path: '/api/tmp-maildiag' };
