/**
 * POST /api/telegram-notify  (internal — called by GitHub Actions / fast_signals.py)
 * Sends outbreak signal notifications to all Telegram subscribers.
 *
 * Body: { signals: SignalObject[], secret: string }
 *   secret = INTERNAL_SECRET env var (prevents abuse)
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN  — bot token
 *   INTERNAL_SECRET     — shared secret for internal calls
 */
import { getStore } from '@netlify/blobs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function tgStore() {
  return getStore({ name: 'telegram-subscribers', consistency: 'strong' });
}

async function tgSend(chat_id, text) {
  if (!TOKEN) return { ok: false, error: 'no token' };
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

function buildMessage(signals) {
  const lvlOrder = { urgent: 0, alert: 1, watch: 2, monitoring: 3 };
  const topSigs = signals
    .filter(s => s.level === 'urgent' || s.level === 'alert')
    .sort((a, b) => (lvlOrder[a.level] ?? 9) - (lvlOrder[b.level] ?? 9) ||
                    (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 6);

  if (!topSigs.length) return null;

  const lines = topSigs.map(sig => {
    const em     = sig.level === 'urgent' ? '🆘' : '🚨';
    const cntry  = sig.iso && sig.iso !== 'XX' ? ` · <b>${sig.iso}</b>` : '';
    const conf   = sig.confidence ? ` ${Math.round(sig.confidence * 100)}%` : '';
    const spike  = sig.spike_ratio ? ` · ${sig.spike_ratio}×` : '';
    const srcCnt = sig.source_count ?? sig.sources?.length ?? 1;
    const srcs   = ` · ${srcCnt} src`;
    const headline = sig.headline
      ? `\n   <i>${sig.headline.slice(0, 90)}</i>`
      : '';

    return `${em} <b>${sig.disease}</b>${cntry}${spike}${conf}${srcs}${headline}`;
  });

  const urgentCount = topSigs.filter(s => s.level === 'urgent').length;
  const alertCount  = topSigs.filter(s => s.level === 'alert').length;
  const header = urgentCount > 0
    ? `🆘 <b>Vigilo — ${urgentCount} URGENT + ${alertCount} ALERT signals</b>`
    : `🚨 <b>Vigilo — ${alertCount} new ALERT signals</b>`;

  return (
    `${header}\n` +
    `<i>${new Date().toUTCString().replace(':00 GMT', ' UTC')}</i>\n\n` +
    lines.join('\n\n') +
    `\n\n🌐 <a href="https://vigilo.cc/app.html">vigilo.cc</a>  · /stop to unsubscribe`
  );
}

function cors(extra = {}) {
  return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors() });

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: cors() }); }

  // Auth check
  const secret = process.env.INTERNAL_SECRET;
  if (secret && body.secret !== secret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: cors() });
  }

  const signals = body.signals ?? [];
  if (!signals.length) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_signals' }), { headers: cors() });
  }

  const message = buildMessage(signals);
  if (!message) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_alert_signals' }), { headers: cors() });
  }

  const store    = tgStore();
  const { blobs } = await store.list().catch(() => ({ blobs: [] }));

  let sent = 0, failed = 0, stale = 0;

  await Promise.allSettled(blobs.map(async ({ key }) => {
    let sub;
    try { sub = await store.getJSON(key); }
    catch { return; }
    if (!sub?.chat_id) return;

    const result = await tgSend(sub.chat_id, message);
    if (result.ok) {
      sent++;
    } else if (result.error_code === 403 || result.error_code === 400) {
      // User blocked the bot or chat not found — clean up
      await store.delete(key).catch(() => {});
      stale++;
    } else {
      failed++;
    }
  }));

  return new Response(
    JSON.stringify({ ok: true, sent, failed, stale, subscribers: blobs.length }),
    { headers: cors() },
  );
};

export const config = { path: '/api/telegram-notify' };
