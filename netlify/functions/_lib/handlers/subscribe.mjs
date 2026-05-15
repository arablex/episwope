import { hashEmail } from '../tokens.mjs';
import { canonicalCountry } from '../countries.mjs';
import { renderVerifyEmail } from '../templates.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure handler. Inputs: parsed body + deps. Output: { status, body }. */
export async function handleSubscribe(input, deps) {
  const email = String(input.email || '').trim().toLowerCase();
  const lang = input.lang === 'ru' ? 'ru' : 'en';
  const country = canonicalCountry(input.country);

  if (!EMAIL_RE.test(email)) {
    return { status: 400, body: { error: 'invalid_email' } };
  }
  if (!country) {
    return { status: 400, body: { error: 'unknown_country' } };
  }

  const key = hashEmail(email);
  let rec = await deps.getSubscriber(key);
  const now = deps.now().toISOString();

  if (!rec) {
    rec = {
      email,
      countries: [country],
      lang,
      status: 'pending',
      verifyToken: deps.randomToken(),
      unsubToken: deps.randomToken(),
      createdAt: now,
      verifiedAt: null,
      lastDigestSentAt: null,
    };
  } else if (rec.status === 'unsubscribed') {
    // Treat as a brand-new subscription: reopen as pending with fresh tokens
    rec.status = 'pending';
    rec.countries = [country];
    rec.lang = lang;
    rec.verifyToken = deps.randomToken();
    rec.unsubToken = deps.randomToken();
    rec.verifiedAt = null;
    rec.createdAt = now;
  } else {
    if (!rec.countries.includes(country)) {
      rec.countries.push(country);
    } else {
      // Already subscribed to this country — no-op, no extra verify email
      return { status: 200, body: { ok: true, alreadySubscribed: true } };
    }
  }

  await deps.putSubscriber(key, rec);

  // Only send verify email if status is still pending
  if (rec.status === 'pending') {
    const verifyUrl = `${deps.siteOrigin}/api/verify?t=${rec.verifyToken}`;
    const unsubUrl = `${deps.siteOrigin}/api/unsubscribe?t=${rec.unsubToken}`;
    const { subject, html, text } = renderVerifyEmail({
      countries: rec.countries,
      verifyUrl,
      unsubUrl,
      lang: rec.lang,
    });
    await deps.sendEmail({ to: rec.email, subject, html, text, listUnsubscribeUrl: unsubUrl });
  }

  return { status: 200, body: { ok: true } };
}
