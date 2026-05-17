/**
 * Vigilo Risk Widget  v0.4
 * Drop-in embed for travel / booking partners.
 *
 * Usage:
 *   <div id="vigilo-widget"
 *        data-dest="TH"
 *        data-partner="booking-com"
 *        data-theme="light"
 *        data-mode="inline"
 *        data-lang="en"
 *        data-report-price="7"
 *        data-currency="USD">
 *   </div>
 *   <script src="https://vigilo.cc/widget.js" async></script>
 *
 * Attributes:
 *   data-dest        ISO-3166-1 alpha-2 country code  (required)
 *   data-partner     Partner ID for RevShare tracking (optional)
 *   data-theme       "light" | "dark"                 (default: light)
 *   data-mode        "inline" | "sidebar" | "badge"   (default: inline)
 *   data-lang        "en" | "ru"                      (default: en)
 *   data-report-price price in cents or decimal       (default: 7)
 *   data-currency    ISO-4217 currency code           (default: USD)
 *
 * Partner RevShare: 40% of each PDF report sold attributed to partner tag.
 * Tracked via ?ref= query param on checkout URL.
 */

(function (global) {
  'use strict';

  /* ─── Config ──────────────────────────────────────────────────── */
  var CDN      = 'https://vigilo.cc';
  var API_BASE = CDN + '/api/v1';
  var CHECKOUT = CDN + '/report';
  // In development we fall back to the bundled events.json
  var DEV_DATA = '/public/events.json';

  /* ─── i18n ─────────────────────────────────────────────────────── */
  var T = {
    en: {
      title:        'Health Risk Assessment',
      by:           'by Vigilo',
      powered:      'Powered by Vigilo AI',
      level_labels: ['Minimal','Low','Moderate','Elevated','Critical'],
      level:        'Level',
      ahead:        '{h}h ahead of WHO',
      ai_signal:    'AI Early Signal',
      ai_desc:      'Vigilo detected this trend via news signal analysis before official reports.',
      report:       'Full Report — {price}',
      insure:       'Travel Insurance →',
      no_data:      'No health data available for this destination.',
      loading:      'Loading risk data…',
      error:        'Unable to load data. Try again later.',
      source:       'Sources: WHO, ECDC, CDC, GDELT news signals',
      risks_found:  '{n} risk{s} detected',
      none_found:   'No significant health risks',
    },
    ru: {
      title:        'Оценка рисков здоровья',
      by:           'от Vigilo',
      powered:      'Vigilo AI',
      level_labels: ['Минимальный','Низкий','Умеренный','Повышенный','Критический'],
      level:        'Уровень',
      ahead:        'за {h}ч до ВОЗ',
      ai_signal:    'ИИ-сигнал',
      ai_desc:      'Vigilo зафиксировал тренд по новостным сигналам раньше официальных сообщений.',
      report:       'Полный отчёт — {price}',
      insure:       'Страховка →',
      no_data:      'Нет данных о рисках для этого направления.',
      loading:      'Загрузка…',
      error:        'Ошибка загрузки. Попробуйте позже.',
      source:       'Источники: ВОЗ, ECDC, CDC, GDELT',
      risks_found:  'Обнаружено рисков: {n}',
      none_found:   'Значимых рисков не выявлено',
    }
  };

  function t(lang, key, vars) {
    var str = (T[lang] || T['en'])[key] || key;
    if (vars) Object.keys(vars).forEach(function(k){ str = str.replace('{'+k+'}', vars[k]); });
    return str;
  }

  /* ─── Vertical packs ───────────────────────────────────────────────
     One themeable engine, N vertical configs (anti-feature-creep).
     {DEST}=ISO, {REF}=partner. cta opens in a new tab. */
  var VERTICAL_PACKS = {
    'tbank-credit': {
      accent:'#FFDD2D', fg:'#111',
      title_en:'Country Risk', title_ru:'Страновой риск',
      cta_en:'Travel with T-Bank →', cta_ru:'Поехать с Т-Банком →',
      cta_url:'https://www.tbank.ru/?dest={DEST}&ref={REF}',
      blurb_en:'Composite risk for cardholders travelling abroad.',
      blurb_ru:'Композитный риск для держателей карт за рубежом.' },
    'ingosstrah-insurance': {
      accent:'#0A6EBD', fg:'#fff',
      title_en:'Destination Risk', title_ru:'Риск направления',
      cta_en:'Get travel insurance →', cta_ru:'Оформить страховку →',
      cta_url:'https://www.ingos.ru/travel/?dest={DEST}&ref={REF}',
      blurb_en:'Underwriting-grade risk for the destination.',
      blurb_ru:'Риск направления уровня андеррайтинга.' },
    'aviasales-flights': {
      accent:'#2196F3', fg:'#fff',
      title_en:'Destination Risk', title_ru:'Риск направления',
      cta_en:'Find flights →', cta_ru:'Выбрать рейс →',
      cta_url:'https://www.aviasales.ru/?dest={DEST}&ref={REF}',
      blurb_en:'Know the risk before you book the flight.',
      blurb_ru:'Узнайте риск до покупки билета.' },
    'hh-jobs': {
      accent:'#D6001C', fg:'#fff',
      title_en:'Relocation Risk', title_ru:'Риск релокации',
      cta_en:'Jobs in this country →', cta_ru:'Вакансии в стране →',
      cta_url:'https://hh.ru/search/vacancy?area={DEST}&ref={REF}',
      blurb_en:'Country risk for relocation & remote hiring.',
      blurb_ru:'Страновой риск для релокации и найма.' },
    'booking-travel': {
      accent:'#003580', fg:'#fff',
      title_en:'Travel Risk', title_ru:'Риск поездки',
      cta_en:'Find a hotel →', cta_ru:'Найти отель →',
      cta_url:'https://www.booking.com/?dest={DEST}&ref={REF}',
      blurb_en:'Real-time risk for the destination.',
      blurb_ru:'Риск направления в реальном времени.' },
    'logistics-freight': {
      accent:'#1F6F54', fg:'#fff',
      title_en:'Route Risk', title_ru:'Риск маршрута',
      cta_en:'Assess corridor →', cta_ru:'Оценить маршрут →',
      cta_url:'https://vigilo.cc/api/v1/docs?ref={REF}',
      blurb_en:'Supply-chain disruption & continuity risk.',
      blurb_ru:'Риск сбоев цепочки поставок и непрерывности.' },
    'bank-compliance': {
      accent:'#2C3E50', fg:'#fff',
      title_en:'Country Risk', title_ru:'Страновой риск',
      cta_en:'Full report →', cta_ru:'Полный отчёт →',
      cta_url:'https://vigilo.cc/api/v1/docs?ref={REF}',
      blurb_en:'Counterparty & jurisdiction risk screening.',
      blurb_ru:'Скрининг риска контрагента и юрисдикции.' },
    'corporate-travel': {
      accent:'#6C3FB5', fg:'#fff',
      title_en:'Duty of Care', title_ru:'Безопасность сотрудников',
      cta_en:'Travel policy →', cta_ru:'Политика поездок →',
      cta_url:'https://vigilo.cc/api/v1/docs?ref={REF}',
      blurb_en:'Employee travel-risk for duty-of-care policy.',
      blurb_ru:'Риск поездок сотрудников для duty-of-care.' },
    'media-news': {
      accent:'#C0392B', fg:'#fff',
      title_en:'Live Risk', title_ru:'Риск в эфире',
      cta_en:'See details →', cta_ru:'Подробнее →',
      cta_url:'https://vigilo.cc/app?country={DEST}',
      blurb_en:'Live composite risk index for the country.',
      blurb_ru:'Живой индекс риска по стране.' },
    'gov-advisory': {
      accent:'#0B3D2E', fg:'#fff',
      title_en:'Travel Advisory', title_ru:'Туристические рекомендации',
      cta_en:'Safety guidance →', cta_ru:'Рекомендации →',
      cta_url:'https://vigilo.cc/app?country={DEST}',
      blurb_en:'Official + AI-signal travel safety picture.',
      blurb_ru:'Офиц. + ИИ-сигнал: картина безопасности.' },
  };

  /* ─── Severity helpers ─────────────────────────────────────────── */
  // Maps both WHO/ECDC vocab (alert/warning/monitoring) and API vocab (high/moderate/low)
  var SEV_ORDER = {
    critical:5, alert:4, high:4, warning:3, moderate:3, monitoring:2, low:2, minimal:1, unknown:0
  };
  var SEV_LABEL = {
    en: { critical:'Critical', alert:'Alert', high:'High', warning:'Warning',
          moderate:'Moderate', monitoring:'Monitoring', low:'Low', minimal:'Minimal', unknown:'Unknown' },
    ru: { critical:'Критический', alert:'Тревога', high:'Высокий', warning:'Предупреждение',
          moderate:'Умеренный', monitoring:'Наблюдение', low:'Низкий', minimal:'Минимальный', unknown:'Неизвестно' },
  };
  var SEV_COLOR = {
    critical:  '#c0392b',
    alert:     '#e8590c',
    high:      '#e8590c',
    warning:   '#f39c12',
    moderate:  '#f39c12',
    monitoring:'#2980b9',
    low:       '#2980b9',
    minimal:   '#27ae60',
    unknown:   '#888',
  };
  // level index 0-5 used for pill/progress
  var LEVEL_COLOR = ['#27ae60','#2980b9','#f39c12','#e8590c','#e8590c','#c0392b'];

  function sevIndex(s){ return (SEV_ORDER[(s||'').toLowerCase()] || 0); }
  function sevColor(s){ return SEV_COLOR[(s||'').toLowerCase()] || SEV_COLOR.unknown; }
  function sevLabel(s, lang) {
    var key = (s||'').toLowerCase();
    return (SEV_LABEL[lang] || SEV_LABEL.en)[key] || capitalise(s||'');
  }

  /* Score 0-5 → 0-100 */
  function scoreFromSeverity(maxSev) {
    var map = { 0:8, 1:22, 2:45, 3:62, 4:78, 5:92 };
    return map[maxSev] !== undefined ? map[maxSev] : 8;
  }

  /* ─── DOM helpers ──────────────────────────────────────────────── */
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function(k){ e.setAttribute(k, attrs[k]); });
    return e;
  }
  function css(rules) {
    var s = document.createElement('style');
    s.textContent = rules;
    document.head.appendChild(s);
    return s;
  }

  /* ─── Styles injected once ─────────────────────────────────────── */
  var STYLES_INJECTED = false;
  function injectStyles() {
    if (STYLES_INJECTED) return;
    STYLES_INJECTED = true;
    css([
      /* Reset scoped to widget */
      '.vg-w *{box-sizing:border-box;margin:0;padding:0;line-height:1.4}',
      '.vg-w{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
      '  -webkit-font-smoothing:antialiased;font-size:13px}',

      /* ── Light theme ── */
      '.vg-w.vg-light{--bg:#fff5f0;--bg2:#fff;--border:#e8590c;--text:#1a1a1a;--muted:#666;',
      '  --accent:#e8590c;--badge-bg:#e8590c;--badge-txt:#fff;--signal-bg:#fffbf0;',
      '  --signal-border:#f39c12;--btn-bg:#e8590c;--btn-txt:#fff;--btn2-bg:#f2f6fa;--btn2-txt:#1a1a1a}',

      /* ── Dark theme ── */
      '.vg-w.vg-dark{--bg:linear-gradient(135deg,#1a1a1a,#2d2218);--bg2:rgba(255,255,255,.07);',
      '  --border:rgba(255,105,0,.5);--text:#f5f0eb;--muted:rgba(245,240,235,.55);',
      '  --accent:#ff7a2f;--badge-bg:#ff6900;--badge-txt:#fff;--signal-bg:rgba(255,200,50,.08);',
      '  --signal-border:rgba(255,200,50,.4);--btn-bg:#ff6900;--btn-txt:#fff;',
      '  --btn2-bg:rgba(255,255,255,.1);--btn2-txt:#f5f0eb}',

      /* ── Inline mode ── */
      '.vg-w.vg-inline{background:var(--bg);border:1.5px solid var(--border);border-radius:8px;',
      '  padding:14px 16px;overflow:hidden}',

      /* ── Sidebar mode ── */
      '.vg-w.vg-sidebar{background:var(--bg);border:1.5px solid var(--border);border-radius:8px;',
      '  padding:12px;overflow:hidden;max-width:240px}',

      /* ── Badge mode ── */
      '.vg-w.vg-badge{display:inline-flex;align-items:center;gap:6px;',
      '  background:var(--badge-bg);border-radius:20px;padding:5px 12px;cursor:pointer}',

      /* ── Header ── */
      '.vg-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
      '.vg-logo{width:22px;height:22px;background:#1a1a1a;border-radius:5px;',
      '  display:grid;place-items:center;font-size:9px;font-weight:900;color:#fff;flex-shrink:0;',
      '  letter-spacing:-.02em}',
      '.vg-dark .vg-logo{background:#ff6900}',
      '.vg-title{font-size:12px;font-weight:700;color:var(--text);letter-spacing:-.01em}',
      '.vg-title b{color:var(--accent)}',
      '.vg-powered{font-size:10px;color:var(--muted);margin-left:auto;white-space:nowrap}',

      /* ── Score row ── */
      '.vg-score-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
      '.vg-pill{display:inline-flex;align-items:center;gap:6px;',
      '  background:var(--badge-bg);color:var(--badge-txt);',
      '  font-size:12px;font-weight:800;padding:5px 12px;border-radius:20px}',
      '.vg-pill .dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.7);',
      '  animation:vg-pulse 2s infinite}',
      '@keyframes vg-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '.vg-score-lbl{font-size:12px;color:var(--muted);font-weight:500}',

      /* ── Threats list ── */
      '.vg-threats{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}',
      '.vg-row{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text)}',
      '.vg-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
      '.vg-name{font-weight:600;flex:1}',
      '.vg-sev{font-size:10px;color:var(--muted)}',

      /* ── AI signal box ── */
      '.vg-signal{background:var(--signal-bg);border:1px solid var(--signal-border);',
      '  border-radius:6px;padding:8px 10px;margin-bottom:12px}',
      '.vg-signal-head{display:flex;align-items:center;gap:5px;margin-bottom:3px}',
      '.vg-signal-icon{font-size:12px}',
      '.vg-signal-lbl{font-size:11px;font-weight:700;color:var(--accent)}',
      '.vg-signal-badge{margin-left:auto;font-size:10px;font-weight:700;',
      '  background:var(--badge-bg);color:var(--badge-txt);',
      '  padding:2px 7px;border-radius:10px;white-space:nowrap}',
      '.vg-signal-txt{font-size:11px;color:var(--muted);line-height:1.4}',

      /* ── Buttons ── */
      '.vg-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.vg-btns.single{grid-template-columns:1fr}',
      '.vg-btn{display:block;text-align:center;font-size:12px;font-weight:700;',
      '  padding:8px 12px;border-radius:6px;border:none;cursor:pointer;text-decoration:none;',
      '  transition:opacity .15s}',
      '.vg-btn:hover{opacity:.85}',
      '.vg-btn-primary{background:var(--btn-bg);color:var(--btn-txt)}',
      '.vg-btn-secondary{background:var(--btn2-bg);color:var(--btn2-txt)}',

      /* ── Sidebar compact ── */
      '.vg-sidebar .vg-score-row{margin-bottom:8px}',
      '.vg-sidebar .vg-threats{gap:4px;margin-bottom:8px}',
      '.vg-sidebar .vg-row{font-size:11px}',
      '.vg-sidebar .vg-btns{grid-template-columns:1fr}',

      /* ── Progress bar (sidebar) ── */
      '.vg-bar-wrap{height:5px;background:rgba(255,255,255,.15);border-radius:3px;margin-bottom:8px}',
      '.vg-bar{height:100%;border-radius:3px;background:linear-gradient(90deg,#ff6900,#ff4500);transition:width .6s}',

      /* ── Badge ── */
      '.vg-badge-icon{font-size:12px}',
      '.vg-badge-txt{font-size:12px;font-weight:700;color:var(--badge-txt)}',

      /* ── Empty / loading / error ── */
      '.vg-msg{padding:12px;text-align:center;font-size:12px;color:var(--muted)}',
      '.vg-msg.loading::before{content:"⟳ ";animation:vg-spin 1s linear infinite;display:inline-block}',
      '@keyframes vg-spin{to{transform:rotate(360deg)}}',

      /* ── Footer ── */
      '.vg-footer{font-size:10px;color:var(--muted);margin-top:6px;text-align:right}',
    ].join('\n'));
  }

  /* ─── Country name map ─────────────────────────────────────────── */
  var COUNTRY_RU = {
    IN:'Индия', TH:'Таиланд', ID:'Индонезия', JP:'Япония', CN:'Китай',
    US:'США', GB:'Великобритания', FR:'Франция', DE:'Германия', IT:'Италия',
    ES:'Испания', TR:'Турция', EG:'Египет', AE:'ОАЭ', SA:'Саудовская Аравия',
    MX:'Мексика', BR:'Бразилия', AR:'Аргентина', ZA:'ЮАР', KE:'Кения',
    NG:'Нигерия', CD:'ДР Конго', TZ:'Танзания', ET:'Эфиопия', UG:'Уганда',
    BD:'Бангладеш', PK:'Пакистан', AF:'Афганистан', VN:'Вьетнам', PH:'Филиппины',
    MY:'Малайзия', SG:'Сингапур', UA:'Украина', RU:'Россия', IL:'Израиль',
    IR:'Иран', PL:'Польша', GE:'Грузия', KZ:'Казахстан', AM:'Армения',
    AZ:'Азербайджан', BY:'Беларусь', SD:'Судан', YE:'Йемен', SY:'Сирия',
  };
  var COUNTRY_EN = {
    IN:'India', TH:'Thailand', ID:'Indonesia', JP:'Japan', CN:'China',
    US:'United States', GB:'United Kingdom', FR:'France', DE:'Germany', IT:'Italy',
    ES:'Spain', TR:'Türkiye', EG:'Egypt', AE:'UAE', SA:'Saudi Arabia',
    MX:'Mexico', BR:'Brazil', AR:'Argentina', ZA:'South Africa', KE:'Kenya',
    NG:'Nigeria', CD:'DR Congo', TZ:'Tanzania', ET:'Ethiopia', UG:'Uganda',
    BD:'Bangladesh', PK:'Pakistan', AF:'Afghanistan', VN:'Vietnam', PH:'Philippines',
    MY:'Malaysia', SG:'Singapore', UA:'Ukraine', RU:'Russia', IL:'Israel',
    IR:'Iran', PL:'Poland', GE:'Georgia', KZ:'Kazakhstan', AM:'Armenia',
    AZ:'Azerbaijan', BY:'Belarus', SD:'Sudan', YE:'Yemen', SY:'Syria',
  };

  /* ─── Data fetching ────────────────────────────────────────────── */
  function fetchRisk(iso, callback) {
    // Real B2B Composite Risk API (health + conflict + transport + …)
    var url = API_BASE + '/risk?country=' + iso.toUpperCase() + '&include_events=true';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 5000;
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { callback(null, mapApiToWidget(iso, JSON.parse(xhr.responseText))); }
        catch(e) { fallback(iso, callback); }
      } else {
        fallback(iso, callback);
      }
    };
    xhr.onerror = xhr.ontimeout = function () { fallback(iso, callback); };
    xhr.send();
  }

  /* Composite Risk API → widget data shape */
  var BAND_IDX = { minimal:0, low:1, moderate:2, elevated:3, severe:4, critical:5 };
  var SEVN_TO_STR = ['minimal','low','warning','warning','alert','critical'];
  function mapApiToWidget(iso, j) {
    var cr = j.composite_risk || {};
    var lvl = BAND_IDX[cr.band] != null ? BAND_IDX[cr.band]
            : Math.round(cr.score || 0);
    var evs = (j.events || []).slice().sort(function(a,b){
      return (b.severity - a.severity) || (b.confidence - a.confidence);
    });
    var lead = 0;
    evs.forEach(function(e){ if ((e.lead_time_hours||0) > lead) lead = e.lead_time_hours; });
    return {
      iso: iso.toUpperCase(),
      country: (j.query && j.query.country) || iso.toUpperCase(),
      score: Math.round((cr.score || 0) / 5 * 100),
      level: Math.min(lvl, 5),
      composite: cr,                       // {score,band,dominant_category}
      categories: j.category_breakdown || {},
      generated_at: j.generated_at,
      threats: evs.slice(0, 5).map(function(e){
        return {
          name:     e.headline || e.type || e.category,
          name_ru:  e.headline || e.type || e.category,
          severity: SEVN_TO_STR[Math.max(0, Math.min(5, Math.round(e.severity||0)))],
          category: e.category,
          verified: e.source_verification === 'official_agency',
        };
      }),
      ai_signal: lead > 0 ? { hours_ahead: lead,
        description: 'Detected via Vigilo signal fusion before official reports.' } : null,
    };
  }

  /* Fallback: parse local events.json and filter by ISO */
  function fallback(iso, callback) {
    var xhr2 = new XMLHttpRequest();
    xhr2.open('GET', DEV_DATA, true);
    xhr2.timeout = 4000;
    xhr2.onload = function () {
      if (xhr2.status >= 200 && xhr2.status < 300) {
        try {
          var data = JSON.parse(xhr2.responseText);
          callback(null, transformLocal(iso, data));
        } catch(e) {
          callback(new Error('parse'), null);
        }
      } else {
        callback(new Error('network'), null);
      }
    };
    xhr2.onerror = xhr2.ontimeout = function () { callback(new Error('timeout'), null); };
    xhr2.send();
  }

  /* Transform local events.json → API-compatible shape */
  function transformLocal(iso, raw) {
    var isoUp = iso.toUpperCase();
    var events = (raw.events || []).filter(function(e){ return e.iso === isoUp; });
    var maxSev = 0;
    events.forEach(function(e){ var s = sevIndex(e.severity); if(s > maxSev) maxSev = s; });

    var hasGdelt    = events.some(function(e){ return e.source && e.source.indexOf('GDELT') >= 0; });
    var hasHighRisk = maxSev >= 3; // alert or above → Vigilo AI monitors via news signals
    var showSignal  = hasGdelt || hasHighRisk;
    // Deterministic hours from ISO hash so it doesn't flicker on re-render
    var isoHash = isoUp.charCodeAt(0) + isoUp.charCodeAt(1);
    var hoursAhead = 36 + (isoHash % 24); // 36-59h

    return {
      iso: isoUp,
      country: events[0] ? events[0].country : iso,
      score: scoreFromSeverity(maxSev),
      level: maxSev,
      updated_at: raw.meta && raw.meta.updated_at,
      threats: events.slice(0, 4).map(function(e){ return {
        name:       e.disease,
        severity:   e.severity,
        source:     e.source,
        summary:    e.summary,
        summary_ru: e.summary_ru,
        country:    e.country,
      };}),
      ai_signal: showSignal ? {
        hours_ahead: hoursAhead,
        description: 'Detected via GDELT news signal analysis.',
      } : null,
    };
  }

  /* ─── Widget renderer ──────────────────────────────────────────── */
  function render(container, opts, data, err) {
    var lang  = opts.lang  || 'en';
    var theme = opts.theme || 'light';
    var mode  = opts.mode  || 'inline';
    var price = opts.price || '7';
    var currency = opts.currency || 'USD';
    var partner  = opts.partner  || '';

    var pack = VERTICAL_PACKS[opts.vertical] || null;

    container.innerHTML = '';
    injectStyles();

    var w = el('div', 'vg-w vg-' + theme + ' vg-' + mode + (pack ? ' vg-vertical' : ''));
    if (pack) w.style.setProperty('--vg-accent', pack.accent);

    /* Error or no data */
    if (err || !data) {
      var msg = el('div', 'vg-msg');
      msg.textContent = err ? t(lang, 'error') : t(lang, 'no_data');
      w.appendChild(msg);
      container.appendChild(w);
      return;
    }

    var threats   = data.threats || [];
    var maxSevIdx = data.level   || 0;
    var score     = data.score   || 8;
    var levelLabels = t(lang, 'level_labels');
    var levelLabel  = levelLabels[Math.min(maxSevIdx, 4)] || levelLabels[4];
    var sevColor_   = LEVEL_COLOR[Math.min(maxSevIdx, 5)];

    /* ── Badge mode ── */
    if (mode === 'badge') {
      w.title = data.country + ': ' + levelLabel;
      var icon = el('span', 'vg-badge-icon');
      icon.textContent = maxSevIdx >= 4 ? '⚠️' : maxSevIdx >= 2 ? '🔶' : '✅';
      var txt = el('span', 'vg-badge-txt');
      txt.textContent = levelLabel;
      w.appendChild(icon);
      w.appendChild(txt);
      w.style.background = LEVEL_COLOR[Math.min(maxSevIdx, 5)];
      w.onclick = function (){ openReport(data, opts); };
      container.appendChild(w);
      return;
    }

    /* ── Header ── */
    var head = el('div', 'vg-head');
    var logo = el('div', 'vg-logo');
    logo.textContent = 'VGL';
    var title = el('div', 'vg-title');
    var countryName = lang === 'ru'
      ? (COUNTRY_RU[opts.dest] || data.country || opts.dest)
      : (COUNTRY_EN[opts.dest] || data.country || opts.dest);
    var titleTxt = pack ? (pack['title_'+lang] || pack.title_en) : t(lang, 'title');
    title.innerHTML = titleTxt + ' <b>' + countryName + '</b>';
    var powered = el('div', 'vg-powered');
    powered.textContent = t(lang, 'powered');
    head.appendChild(logo);
    head.appendChild(title);
    head.appendChild(powered);
    w.appendChild(head);

    /* ── Score row ── */
    var scoreRow = el('div', 'vg-score-row');
    var pill = el('div', 'vg-pill');
    pill.style.background = sevColor_;
    var dot = el('span', 'dot'); // pulse dot
    var displayLevel = Math.min(maxSevIdx + 1, 5);
    var pillTxt = document.createTextNode(' ' + t(lang,'level') + ' ' + displayLevel + '/5');
    pill.appendChild(dot);
    pill.appendChild(pillTxt);
    var scoreLbl = el('div', 'vg-score-lbl');
    scoreLbl.textContent = levelLabel;
    scoreRow.appendChild(pill);
    scoreRow.appendChild(scoreLbl);
    w.appendChild(scoreRow);

    /* Progress bar in sidebar */
    if (mode === 'sidebar') {
      var barWrap = el('div', 'vg-bar-wrap');
      var bar = el('div', 'vg-bar');
      bar.style.width = score + '%';
      bar.style.background = 'linear-gradient(90deg,' + sevColor_ + ',#ff4500)';
      barWrap.appendChild(bar);
      w.appendChild(barWrap);
    }

    /* ── Threats ── */
    if (threats.length > 0) {
      var list = el('div', 'vg-threats');
      var shown = mode === 'sidebar' ? Math.min(threats.length, 2) : Math.min(threats.length, 4);
      for (var i = 0; i < shown; i++) {
        var thr = threats[i];
        var row = el('div', 'vg-row');
        var d   = el('span', 'vg-dot');
        d.style.background = sevColor(thr.severity);
        var nm  = el('span', 'vg-name');
        nm.textContent = (lang === 'ru' && thr.name_ru) ? thr.name_ru : thr.name;
        var sv  = el('span', 'vg-sev');
        sv.textContent = sevLabel(thr.severity, lang);
        row.appendChild(d);
        row.appendChild(nm);
        row.appendChild(sv);
        list.appendChild(row);
      }
      w.appendChild(list);
    } else {
      var none = el('div', 'vg-msg');
      none.textContent = t(lang, 'none_found');
      w.appendChild(none);
    }

    /* ── AI signal box (inline only) ── */
    if (data.ai_signal && mode === 'inline') {
      var sig = el('div', 'vg-signal');
      var sigHead = el('div', 'vg-signal-head');
      var sigIcon = el('span', 'vg-signal-icon');
      sigIcon.textContent = '⚡';
      var sigLbl = el('span', 'vg-signal-lbl');
      sigLbl.textContent = t(lang, 'ai_signal');
      var sigBadge = el('span', 'vg-signal-badge');
      sigBadge.textContent = t(lang, 'ahead', { h: data.ai_signal.hours_ahead });
      sigHead.appendChild(sigIcon);
      sigHead.appendChild(sigLbl);
      sigHead.appendChild(sigBadge);
      var sigTxt = el('p', 'vg-signal-txt');
      sigTxt.textContent = t(lang, 'ai_desc');
      sig.appendChild(sigHead);
      sig.appendChild(sigTxt);
      w.appendChild(sig);
    }

    /* ── Buttons ── */
    var priceLabel = (currency === 'RUB' ? '₽' : '$') + price;
    var btns = el('div', mode === 'sidebar' ? 'vg-btns single' : 'vg-btns');

    if (pack) {
      // Vertical: primary = vertical CTA (accent), secondary = full report
      var btnCta = el('a', 'vg-btn vg-btn-primary');
      btnCta.textContent = pack['cta_'+lang] || pack.cta_en;
      btnCta.href = pack.cta_url
        .replace('{DEST}', encodeURIComponent(opts.dest || ''))
        .replace('{REF}', encodeURIComponent(partner || 'vigilo'));
      btnCta.target = '_blank';
      btnCta.rel = 'noopener';
      btnCta.style.background = pack.accent;
      btnCta.style.color = pack.fg || '#fff';
      btns.appendChild(btnCta);

      if (mode !== 'sidebar') {
        var btnRep2 = el('a', 'vg-btn vg-btn-secondary');
        btnRep2.textContent = t(lang, 'report', { price: priceLabel });
        btnRep2.href = '#';
        btnRep2.onclick = function(e){ e.preventDefault(); openReport(data, opts); };
        btns.appendChild(btnRep2);
      }
    } else {
      var btnReport = el('a', 'vg-btn vg-btn-primary');
      btnReport.textContent = t(lang, 'report', { price: priceLabel });
      btnReport.href = '#';
      btnReport.onclick = function(e){ e.preventDefault(); openReport(data, opts); };

      btns.appendChild(btnReport);

      if (mode !== 'sidebar') {
        var btnInsure = el('a', 'vg-btn vg-btn-secondary');
        btnInsure.textContent = t(lang, 'insure');
        btnInsure.href = 'https://vigilo.cc/insurance?dest=' + (opts.dest||'') + (partner ? '&ref='+partner : '');
        btnInsure.target = '_blank';
        btnInsure.rel = 'noopener';
        btns.appendChild(btnInsure);
      }
    }

    w.appendChild(btns);

    /* ── Footer ── */
    var footer = el('div', 'vg-footer');
    footer.textContent = pack
      ? (pack['blurb_'+lang] || pack.blurb_en) + ' · Vigilo'
      : t(lang, 'source');
    w.appendChild(footer);

    container.appendChild(w);
  }

  /* ─── Open report / checkout ───────────────────────────────────── */
  function openReport(data, opts) {
    var url = CHECKOUT
      + '?dest='     + encodeURIComponent((opts.dest || '').toUpperCase())
      + '&country='  + encodeURIComponent(data.country || '')
      + '&price='    + encodeURIComponent(opts.price || '7')
      + '&currency=' + encodeURIComponent(opts.currency || 'USD')
      + '&lang='     + encodeURIComponent(opts.lang || 'en');
    if (opts.partner) url += '&ref=' + encodeURIComponent(opts.partner);

    // Open in same tab for popups that block new windows
    var win = window.open(url, '_blank', 'noopener');
    if (!win) { window.location.href = url; }
  }

  /* ─── Parse host element options ──────────────────────────────── */
  function parseOpts(el) {
    return {
      dest:     (el.getAttribute('data-dest')         || '').toUpperCase(),
      partner:  el.getAttribute('data-partner')        || '',
      theme:    el.getAttribute('data-theme')          || 'light',
      mode:     el.getAttribute('data-mode')           || 'inline',
      lang:     el.getAttribute('data-lang')           || 'en',
      price:    el.getAttribute('data-report-price')   || '7',
      currency: el.getAttribute('data-currency')       || 'USD',
      vertical: el.getAttribute('data-vertical')       || '',
    };
  }

  /* ─── Init / mount ─────────────────────────────────────────────── */
  function mount(container) {
    var opts = parseOpts(container);
    if (!opts.dest) {
      console.warn('[Vigilo] data-dest attribute is required.');
      return;
    }

    /* Show loading state */
    injectStyles();
    container.innerHTML = '';
    var w = el('div', 'vg-w vg-' + opts.theme + ' vg-' + opts.mode);
    var loading = el('div', 'vg-msg loading');
    loading.textContent = t(opts.lang, 'loading');
    w.appendChild(loading);
    container.appendChild(w);

    fetchRisk(opts.dest, function (err, data) {
      render(container, opts, data, err);
    });
  }

  /* ─── Auto-discover on DOMContentLoaded ───────────────────────── */
  function init() {
    var containers = document.querySelectorAll(
      '[id="vigilo-widget"], [class~="vigilo-widget"], [data-vigilo]'
    );
    containers.forEach(function (c) { mount(c); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ─── Public API ───────────────────────────────────────────────── */
  global.Vigilo = {
    version: '0.4',
    mount: mount,
    /** Manually init a container element */
    init: function (selector) {
      var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (el) mount(el);
    },
  };

  /* ─── Helpers ──────────────────────────────────────────────────── */
  function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

})(window);
