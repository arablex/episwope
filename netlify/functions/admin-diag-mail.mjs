// netlify/functions/admin-diag-mail.mjs
//
// Protected mail diagnostics. Requires Authorization: Bearer <EPISCOPE_TOKEN_SECRET>.
//
//   GET  /api/admin/diag-mail            → env presence report
//   POST /api/admin/diag-mail {email}    → attempts a real Resend send,
//                                          returns the ACTUAL Resend response/error
//
// Use this to see why magic-link mail is silently failing (the magic-link
// handler swallows the error to prevent user enumeration).

import { checkBearerAuth } from './_lib/auth.mjs';

const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (!checkBearerAuth(req)) {
    return new Response('forbidden', { status: 403 });
  }

  const key = process.env.RESEND_API_KEY || '';
  const envReport = {
    RESEND_API_KEY_set: !!key,
    RESEND_API_KEY_len: key.length,
    RESEND_API_KEY_prefix: key ? key.slice(0, 4) : null, // "re_" expected
    JWT_SECRET_set: !!process.env.JWT_SECRET,
    from: 'EpiScope <noreply@episcope.ru>',
  };

  if (req.method === 'GET') {
    return J({ ok: true, env: envReport });
  }

  if (req.method !== 'POST') {
    return J({ error: 'method_not_allowed' }, 405);
  }

  let to;
  try {
    ({ email: to } = await req.json());
  } catch {
    return J({ error: 'invalid_json' }, 400);
  }
  if (!to || !String(to).includes('@')) {
    return J({ error: 'invalid_email', env: envReport }, 400);
  }

  if (!key) {
    return J({ ok: false, env: envReport, error: 'RESEND_API_KEY is not configured in Netlify env' }, 200);
  }

  // Attempt a real send and surface the exact Resend response.
  let resendStatus = null, resendBody = null, threw = null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EpiScope <noreply@episcope.ru>',
        to: [String(to).trim().toLowerCase()],
        subject: 'EpiScope mail diagnostic',
        html: '<p>If you received this, Resend + domain are working.</p>',
        text: 'If you received this, Resend + domain are working.',
      }),
    });
    resendStatus = res.status;
    resendBody = await res.text();
  } catch (e) {
    threw = e.message;
  }

  return J({
    ok: resendStatus >= 200 && resendStatus < 300,
    env: envReport,
    resend: { status: resendStatus, body: resendBody, exception: threw },
    hint: resendStatus === 403 || (resendBody && /domain/i.test(resendBody))
      ? 'Likely: episcope.ru is not a verified domain in Resend. Add the domain in Resend → verify DKIM/SPF DNS records.'
      : resendStatus === 401
      ? 'Likely: RESEND_API_KEY is invalid or revoked.'
      : null,
  });
};

export const config = { path: '/api/admin/diag-mail' };
