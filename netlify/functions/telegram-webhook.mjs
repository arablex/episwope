/**
 * POST /.netlify/functions/telegram-webhook
 * Receives updates from Telegram Bot API.
 *
 * Commands:
 *   /start   — subscribe to outbreak alerts
 *   /stop    — unsubscribe
 *   /status  — show current top signals
 *   /help    — show help
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN  — bot token from @BotFather
 *
 * Storage: Netlify Blobs store "telegram-subscribers"
 *   key = chat_id (string), value = JSON { chat_id, first_name, username, subscribed_at, lang }
 */
import { getStore } from '@netlify/blobs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function tgStore() {
  return getStore({ name: 'telegram-subscribers', consistency: 'strong' });
}

async function tgSend(chat_id, text, extra = {}) {
  if (!TOKEN) return;
  const body = JSON.stringify({
    chat_id,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

async function getCurrentSignals() {
  try {
    const r = await fetch('https://vigilo.cc/public/signals.json', { cache: 'no-store' });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

function formatSignal(sig) {
  const lvlEmoji = { urgent: '🆘', alert: '🚨', watch: '⚠️', monitoring: '📡' }[sig.level] ?? '📡';
  const country  = sig.iso && sig.iso !== 'XX' ? ` · ${sig.iso}` : '';
  const spike    = sig.spike_ratio ? ` · ${sig.spike_ratio}× spike` : '';
  const src      = sig.sources?.slice(0, 3).join(', ') ?? '';
  return `${lvlEmoji} <b>${sig.disease}</b>${country}${spike}\n<i>${src}</i>`;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  let update;
  try { update = await req.json(); }
  catch { return new Response('bad json', { status: 400 }); }

  const msg = update.message || update.channel_post;
  if (!msg) return new Response('ok');

  const chat_id    = msg.chat.id;
  const text       = (msg.text || '').trim();
  const first_name = msg.chat.first_name || msg.chat.title || '';
  const username   = msg.chat.username || '';
  const lang       = msg.from?.language_code || 'en';

  const store = tgStore();
  const key   = String(chat_id);

  // ── /start ─────────────────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    await store.setJSON(key, {
      chat_id, first_name, username,
      subscribed_at: new Date().toISOString(),
      lang,
    });

    const name = first_name ? ` ${first_name}` : '';
    await tgSend(chat_id,
      `🌍 <b>Welcome to Vigilo${name}!</b>\n\n` +
      `You'll receive <b>ALERT</b> and <b>URGENT</b> outbreak signals — ` +
      `up to 72 hours before mainstream media.\n\n` +
      `🆘 URGENT  — multi-source, high confidence\n` +
      `🚨 ALERT  — confirmed signal\n` +
      `⚠️ WATCH  — early/uncertain\n\n` +
      `/stop — unsubscribe\n` +
      `/status — current signals\n\n` +
      `🌐 <a href="https://vigilo.cc">vigilo.cc</a>`,
    );
    return new Response('ok');
  }

  // ── /stop ──────────────────────────────────────────────────────────────────
  if (text === '/stop') {
    await store.delete(key).catch(() => {});
    await tgSend(chat_id,
      '👋 Unsubscribed. You will no longer receive outbreak alerts.\n\n' +
      'Send /start any time to re-subscribe.',
    );
    return new Response('ok');
  }

  // ── /status ────────────────────────────────────────────────────────────────
  if (text === '/status' || text === '/signals') {
    const sigs = await getCurrentSignals();
    if (!sigs.length) {
      await tgSend(chat_id, '📡 No active signals at the moment. Check back later.');
      return new Response('ok');
    }

    const top = sigs
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 8);

    const lines = top.map(formatSignal).join('\n\n');
    await tgSend(chat_id,
      `🌍 <b>Vigilo — Current Signals</b>\n` +
      `<i>${sigs.length} active · updated every 15 min</i>\n\n` +
      lines +
      `\n\n🌐 <a href="https://vigilo.cc/app.html">Open full map</a>`,
    );
    return new Response('ok');
  }

  // ── /help ──────────────────────────────────────────────────────────────────
  if (text === '/help' || text === '/info') {
    await tgSend(chat_id,
      `<b>Vigilo Bot</b> — outbreak alerts from 26 global sources\n\n` +
      `/start — subscribe to alerts\n` +
      `/stop — unsubscribe\n` +
      `/status — show current signals\n\n` +
      `🌐 <a href="https://vigilo.cc">vigilo.cc</a>`,
    );
    return new Response('ok');
  }

  // Unknown command — gentle prompt
  if (text.startsWith('/')) {
    await tgSend(chat_id, 'Unknown command. Try /start /stop /status /help');
  }

  return new Response('ok');
};

export const config = { path: '/api/telegram-webhook' };
