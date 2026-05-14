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
    verifySubject: 'Confirm your EpiScope subscription',
    verifyHeadline: 'Confirm your EpiScope subscription',
    verifyBody: 'You asked to follow these countries:',
    verifyCta: 'Confirm subscription',
    verifyFooter: "If you didn't sign up, ignore this email or",
    unsubscribeWord: 'unsubscribe',
  },
  ru: {
    verifySubject: 'Подтверди подписку на EpiScope',
    verifyHeadline: 'Подтверди подписку на EpiScope',
    verifyBody: 'Ты подписываешься на эти страны:',
    verifyCta: 'Подтвердить подписку',
    verifyFooter: 'Если ты не подписывался — проигнорируй или',
    unsubscribeWord: 'отпишись',
  },
};

export function renderVerifyEmail({ countries, verifyUrl, unsubUrl, lang }) {
  const L = STRINGS[lang] || STRINGS.en;
  const list = countries.map(escapeHtml);
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
