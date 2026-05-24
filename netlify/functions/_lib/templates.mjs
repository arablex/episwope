function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STRINGS = {
  en: {
    verifySubject: 'Confirm your Vigilo subscription',
    verifyHeadline: 'Confirm your Vigilo subscription',
    verifyBody: 'You asked to follow these countries:',
    verifyCta: 'Confirm subscription',
    verifyFooter: "If you didn't sign up, ignore this email or",
    unsubscribeWord: 'unsubscribe',
  },
  ru: {
    verifySubject: 'Подтверди подписку на Vigilo',
    verifyHeadline: 'Подтверди подписку на Vigilo',
    verifyBody: 'Ты подписываешься на эти страны:',
    verifyCta: 'Подтвердить подписку',
    verifyFooter: 'Если ты не подписывался — проигнорируй или',
    unsubscribeWord: 'отпишись',
  },
};

export function renderVerifyEmail({ countries, verifyUrl, unsubUrl, lang, globalDigest }) {
  const L = STRINGS[lang] || STRINGS.en;
  const gd = lang === 'ru' ? 'Еженедельный глобальный дайджест' : 'Weekly global digest';
  const scope = [...(globalDigest ? [gd] : []), ...(countries || [])];
  const list = scope.map(escapeHtml);
  const htmlList = list.map((c) => `<li>${c}</li>`).join('');
  const textList = list.map((c) => `  • ${c}`).join('\n');

  const html = `<!doctype html>
<html lang="${lang}">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#0F0E0C;background:#F4F2EE;margin:0;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ECEAE2;border-radius:14px;padding:32px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 16px;">${L.verifyHeadline}</h1>
      <p style="font-size:14px;line-height:1.55;color:#3B3A36;margin:0 0 16px;">${L.verifyBody}</p>
      <ul style="font-size:14px;line-height:1.55;color:#0F0E0C;padding-left:18px;margin:0 0 24px;">${htmlList}</ul>
      <p style="margin:0 0 28px;"><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:#0F0E0C;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:10px;">${L.verifyCta}</a></p>
      <p style="font-size:11.5px;line-height:1.55;color:#807E76;margin:0;">${L.verifyFooter} <a href="${escapeHtml(unsubUrl)}" style="color:#807E76;">${L.unsubscribeWord}</a>.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${L.verifyHeadline}

${L.verifyBody}
${textList}

${L.verifyCta}: ${verifyUrl}

${L.verifyFooter} ${L.unsubscribeWord}: ${unsubUrl}
`;

  return { subject: L.verifySubject, html, text };
}

export function renderMagicLinkEmail({ loginUrl, lang }) {
  const L = {
    en: {
      subject:  'Your Vigilo login link',
      headline: 'Log in to Vigilo Pro',
      body:     'Click the button below to access your account. The link is valid for 30 days.',
      cta:      'Log in to Vigilo',
      footer:   "If you didn't request this link, you can safely ignore this email.",
    },
    ru: {
      subject:  'Ссылка для входа в Vigilo',
      headline: 'Войти в Vigilo Pro',
      body:     'Нажми кнопку ниже чтобы войти в аккаунт. Ссылка действует 30 дней.',
      cta:      'Войти в Vigilo',
      footer:   'Если ты не запрашивал эту ссылку — просто проигнорируй письмо.',
    },
  }[lang] ?? {
    subject:  'Your Vigilo login link',
    headline: 'Log in to Vigilo Pro',
    body:     'Click the button below to access your account. The link is valid for 30 days.',
    cta:      'Log in to Vigilo',
    footer:   "If you didn't request this link, you can safely ignore this email.",
  };

  const url = escapeHtml(loginUrl);
  const html = `<!doctype html>
<html lang="${lang}">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#0F0E0C;background:#F4F2EE;margin:0;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ECEAE2;border-radius:14px;padding:32px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 16px;">${L.headline}</h1>
      <p style="font-size:14px;line-height:1.55;color:#3B3A36;margin:0 0 28px;">${L.body}</p>
      <p style="margin:0 0 28px;"><a href="${url}" style="display:inline-block;background:#0F0E0C;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:10px;">${L.cta}</a></p>
      <p style="font-size:11.5px;line-height:1.55;color:#807E76;margin:0;">${L.footer}</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${L.headline}\n\n${L.body}\n\n${L.cta}: ${loginUrl}\n\n${L.footer}`;
  return { subject: L.subject, html, text };
}

/**
 * renderAlertEmail({ events, lang })
 *
 * Outbreak-alert email sent when new critical/alert events are found
 * in a subscriber's watched countries.
 *
 * @param {Array}  events  — array of event objects (from events.json)
 * @param {string} lang    — 'en' | 'ru'
 */
export function renderAlertEmail({ events, lang = 'en' }) {
  const count = events.length;

  const STRINGS = {
    en: {
      subject:  (n) => `Vigilo Alert: ${n} new outbreak${n !== 1 ? 's' : ''} in your watched countries`,
      headline: 'Outbreak Alert',
      intro:    'New disease activity was detected in countries you follow:',
      cta:      'Open Vigilo',
      ctaUrl:   'https://vigilo.cc/',
      footer:   'You are receiving these alerts because you subscribed to Vigilo outbreak monitoring.',
      critical: '🔴 Critical',
      alert:    '🟠 Alert',
      warning:  '🟡 Warning',
    },
    ru: {
      subject:  (n) => `Vigilo: ${n} нов${n === 1 ? 'ая вспышка' : 'ых вспышки'} в ваших странах`,
      headline: 'Уведомление о вспышке',
      intro:    'Обнаружена новая эпидемическая активность в странах, которые вы отслеживаете:',
      cta:      'Открыть Vigilo',
      ctaUrl:   'https://vigilo.cc/ru/',
      footer:   'Вы получаете эти уведомления, потому что подписались на мониторинг вспышек Vigilo.',
      critical: '🔴 Критическая',
      alert:    '🟠 Тревога',
      warning:  '🟡 Предупреждение',
    },
  };

  const L = STRINGS[lang] || STRINGS.en;

  const badgeLabel = (sev) => L[sev] || escapeHtml(sev);

  const htmlRows = events.map((ev) => {
    const summary = ev[lang === 'ru' && ev.summary_ru ? 'summary_ru' : 'summary'] || '';
    const snippet = summary.length > 220 ? summary.slice(0, 220) + '…' : summary;
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #ECEAE2;">
          <div style="font-size:11.5px;color:#807E76;margin-bottom:3px;">${escapeHtml(ev.country || '—')} · ${badgeLabel(ev.severity)}</div>
          <div style="font-size:14px;font-weight:700;color:#0F0E0C;">${escapeHtml(ev.disease || '—')}</div>
          ${snippet ? `<div style="font-size:13px;color:#3B3A36;margin-top:5px;line-height:1.55;">${escapeHtml(snippet)}</div>` : ''}
          ${ev.link ? `<div style="margin-top:6px;"><a href="${escapeHtml(ev.link)}" style="font-size:12px;color:#807E76;">Source →</a></div>` : ''}
        </td>
      </tr>`;
  }).join('');

  const textRows = events.map((ev) => {
    const summary = ev[lang === 'ru' && ev.summary_ru ? 'summary_ru' : 'summary'] || '';
    const snippet = summary.length > 200 ? summary.slice(0, 200) + '…' : summary;
    return `• ${ev.country || '—'} — ${ev.disease || '—'} [${ev.severity}]\n  ${snippet}${ev.link ? `\n  ${ev.link}` : ''}`;
  }).join('\n\n');

  const html = `<!doctype html>
<html lang="${lang}">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#0F0E0C;background:#F4F2EE;margin:0;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ECEAE2;border-radius:14px;padding:32px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;">${L.headline}</h1>
      <p style="font-size:14px;line-height:1.55;color:#3B3A36;margin:0 0 20px;">${L.intro}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">${htmlRows}</table>
      <p style="margin:0 0 28px;"><a href="${escapeHtml(L.ctaUrl)}" style="display:inline-block;background:#0F0E0C;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:10px;">${L.cta}</a></p>
      <p style="font-size:11.5px;line-height:1.55;color:#807E76;margin:0;">${L.footer}</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${L.headline}\n\n${L.intro}\n\n${textRows}\n\n${L.cta}: ${L.ctaUrl}\n\n${L.footer}`;
  return { subject: L.subject(count), html, text };
}
