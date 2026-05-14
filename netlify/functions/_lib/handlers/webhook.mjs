// netlify/functions/_lib/handlers/webhook.mjs
import { hashEmail } from '../tokens.mjs';

const KILL_EVENTS = new Set(['email.complained']);

export async function handleResendWebhook(event, deps) {
  const type = event?.type;
  const toList = event?.data?.to || [];
  const email = Array.isArray(toList) ? toList[0] : toList;

  let shouldKill = false;
  if (type === 'email.bounced') {
    shouldKill = event?.data?.bounce?.type === 'hard';
  } else if (KILL_EVENTS.has(type)) {
    shouldKill = true;
  }

  if (!shouldKill || !email) {
    return { status: 200, body: { ok: true, skipped: true } };
  }

  const rec = await deps.findByEmail(email);
  if (rec) {
    rec.status = 'unsubscribed';
    const key = rec.__key || hashEmail(rec.email);
    await deps.putSubscriber(key, rec);
  }
  return { status: 200, body: { ok: true } };
}
