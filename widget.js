/**
 * Vigilo Risk Widgets  v1.0
 * Drop-in, brand-themeable embeds for partner sites.
 *
 *   <div class="vigilo-widget"
 *        data-widget="smartcard"        smartcard | checkout
 *        data-dest="TR"                 ISO-3166-1 alpha-2  (required)
 *        data-lang="en"                 en | ru
 *        data-theme="light"             light | dark
 *        data-accent="#E8590C"          primary / brand colour
 *        data-accent-2="#1A1916"        secondary (CTA text on accent)
 *        data-bg="#FFFFFF"              card background  (optional override)
 *        data-fg="#0F0E0C"              text colour      (optional override)
 *        data-radius="md"               none|sm|md|lg|full  or  e.g. "10px"
 *        data-partner="islet"           RevShare ref     (optional)
 *        data-report-price="7"          checkout upsell price
 *        data-currency="USD"            USD | RUB | EUR
 *   ></div>
 *   <script src="https://vigilo.cc/widget.js" async></script>
 *
 * Isolation: every node is under .vgl-w with a hard reset + CSS custom
 * properties, so partner CSS cannot bleed in and our styles cannot leak out.
 */
(function (global) {
  'use strict';

  var CDN = 'https://vigilo.cc';
  var API = CDN + '/api/v1';
  var REPORT = CDN + '/report';

  /* ─── i18n ───────────────────────────────────────────────────────── */
  var I = {
    en: {
      sc_title:'Safety & Risk', sc_sub:'Live composite risk',
      score:'Risk score', of5:'/ 5', updated:'Updated',
      cta_report:'Full safety report', cta_view:'View details',
      co_title:'Add destination risk report',
      co_desc:'AI-verified safety briefing for {c} — outbreaks, conflict, transport & entry.',
      co_add:'Add for {p}', co_added:'Added to order',
      none:'No significant risks detected', src:'Vigilo · WHO · ECDC · GDELT',
      lead:'{h}h ahead of official reports', loading:'Loading…',
      err:'Risk data unavailable',
      sample:'See a sample report', smp_tag:'Sample',
      smp_title:'Risk Report', smp_overview:'Risk overview',
      smp_domains:'Risk by domain', smp_signals:'Verified signals',
      smp_method:'Methodology', smp_methtxt:'Composite of WHO/ECDC/CDC official feeds + AI-classified GDELT/news signals, severity-anchored 0–5 with recency decay.',
      smp_sig1:'WHO IHR notification', smp_sig2:'ECDC communicable-disease bulletin',
      smp_sig3:'GDELT news cluster (AI-verified)',
      smp_official:'Official', smp_ai:'AI signal',
      smp_get:'Get the full report — {p}', smp_dis:'Sample — illustrative report format. Live figures above are real for this destination.',
      close:'Close',
      cats:{health:'Health',conflict:'Conflict',civil_unrest:'Unrest',
        transport:'Transport',border:'Border',infrastructure:'Infrastructure',
        climate:'Climate'}
    },
    ru: {
      sc_title:'Безопасность', sc_sub:'Живой композитный риск',
      score:'Индекс риска', of5:'/ 5', updated:'Обновлено',
      cta_report:'Полный отчёт', cta_view:'Подробнее',
      co_title:'Добавить отчёт о рисках направления',
      co_desc:'ИИ-сводка по {c}: вспышки, конфликты, транспорт и въезд.',
      co_add:'Добавить за {p}', co_added:'Добавлено в заказ',
      none:'Значимых рисков не выявлено', src:'Vigilo · ВОЗ · ECDC · GDELT',
      lead:'на {h}ч раньше официальных сводок', loading:'Загрузка…',
      err:'Данные о риске недоступны',
      sample:'Посмотреть образец отчёта', smp_tag:'Образец',
      smp_title:'Отчёт о рисках', smp_overview:'Сводка риска',
      smp_domains:'Риск по доменам', smp_signals:'Подтверждённые сигналы',
      smp_method:'Методология', smp_methtxt:'Композит официальных лент ВОЗ/ECDC/CDC + ИИ-классификация сигналов GDELT/новостей, шкала 0–5 по тяжести с затуханием по свежести.',
      smp_sig1:'Уведомление ВОЗ IHR', smp_sig2:'Бюллетень ECDC по инфекциям',
      smp_sig3:'Новостной кластер GDELT (ИИ-проверка)',
      smp_official:'Официальный', smp_ai:'ИИ-сигнал',
      smp_get:'Получить полный отчёт — {p}', smp_dis:'Образец — формат отчёта. Цифры выше реальны для этого направления.',
      close:'Закрыть',
      cats:{health:'Здоровье',conflict:'Конфликт',civil_unrest:'Беспорядки',
        transport:'Транспорт',border:'Границы',infrastructure:'Инфраструктура',
        climate:'Стихия'}
    }
  };
  function t(l,k){ return (I[l]||I.en)[k]; }

  var CN = {
    en:{TR:'Türkiye',TH:'Thailand',UA:'Ukraine',DE:'Germany',ES:'Spain',CN:'China',
      RU:'Russia',IL:'Israel',IR:'Iran',PK:'Pakistan',IN:'India',US:'United States',
      GB:'United Kingdom',FR:'France',IT:'Italy',EG:'Egypt',AE:'UAE',SA:'Saudi Arabia',
      ID:'Indonesia',VN:'Vietnam',MX:'Mexico',BR:'Brazil',JP:'Japan',SG:'Singapore',
      GE:'Georgia',KZ:'Kazakhstan',NG:'Nigeria',KE:'Kenya',ET:'Ethiopia',MA:'Morocco'},
    ru:{TR:'Турция',TH:'Таиланд',UA:'Украина',DE:'Германия',ES:'Испания',CN:'Китай',
      RU:'Россия',IL:'Израиль',IR:'Иран',PK:'Пакистан',IN:'Индия',US:'США',
      GB:'Великобритания',FR:'Франция',IT:'Италия',EG:'Египет',AE:'ОАЭ',SA:'Саудовская Аравия',
      ID:'Индонезия',VN:'Вьетнам',MX:'Мексика',BR:'Бразилия',JP:'Япония',SG:'Сингапур',
      GE:'Грузия',KZ:'Казахстан',NG:'Нигерия',KE:'Кения',ET:'Эфиопия',MA:'Марокко'}
  };
  function cname(iso,l){ return (CN[l]||CN.en)[iso] || (CN.en[iso]) || iso; }

  /* ─── Risk bands ─────────────────────────────────────────────────── */
  var BANDS=['minimal','low','moderate','elevated','severe','critical'];
  var BAND_C={minimal:'#5b9d6b',low:'#caa53d',moderate:'#e2820f',
    elevated:'#d8531e',severe:'#c0392b',critical:'#7d1a12'};
  var BAND_L={
    en:{minimal:'Minimal',low:'Low',moderate:'Moderate',elevated:'Elevated',
      severe:'Severe',critical:'Critical'},
    ru:{minimal:'Минимальный',low:'Низкий',moderate:'Умеренный',
      elevated:'Повышенный',severe:'Высокий',critical:'Критический'}
  };
  function bandOf(score){ return BANDS[Math.max(0,Math.min(5,Math.round(score)))]; }

  /* ─── Icons (consistent 1.6 stroke, no emoji) ────────────────────── */
  function svg(p){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '+
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
  var IC={
    health:svg('<path d="M3 12h3l2 5 4-12 2 7h7"/>'),
    conflict:svg('<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
    civil_unrest:svg('<path d="M3 21h18M6 21V9M10 21V6M14 21V9M18 21V4"/>'),
    transport:svg('<path d="M3 17h18M6 17V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10M8 21v-2M16 21v-2"/>'),
    border:svg('<path d="M12 2v20M5 6l7-3 7 3M5 6v6a7 7 0 0 0 14 0V6"/>'),
    infrastructure:svg('<path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6"/>'),
    climate:svg('<path d="M12 2v3M5 12H2M22 12h-3M6 6 4 4M18 6l2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>'),
    shield:svg('<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>'),
    arrow:svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    bolt:svg('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'),
    check:svg('<path d="M20 6 9 17l-5-5"/>')
  };

  /* ─── Theming → CSS custom properties ────────────────────────────── */
  var RADII={none:'0',sm:'8px',md:'14px',lg:'20px',full:'9999px'};
  function radius(v){
    if(!v) return RADII.md;
    if(RADII[v]) return RADII[v];
    return /^\d/.test(v) ? v : RADII.md;
  }
  function themeVars(o){
    var dark = o.theme==='dark';
    var bg = o.bg || (dark?'#16140F':'#FFFFFF');
    var fg = o.fg || (dark?'#F4F2EE':'#0F0E0C');
    var muted = dark?'rgba(244,242,238,.56)':'rgba(15,14,12,.52)';
    var line = dark?'rgba(244,242,238,.14)':'rgba(15,14,12,.10)';
    var soft = dark?'rgba(244,242,238,.06)':'rgba(15,14,12,.035)';
    var acc = o.accent || '#E8590C';
    var acc2 = o.accent2 || '#FFFFFF';
    return [
      '--vgl-acc:'+acc, '--vgl-acc2:'+acc2, '--vgl-bg:'+bg, '--vgl-fg:'+fg,
      '--vgl-muted:'+muted, '--vgl-line:'+line, '--vgl-soft:'+soft,
      '--vgl-r:'+radius(o.radius)
    ].join(';');
  }

  /* ─── Styles (scoped, injected once) ─────────────────────────────── */
  var CSS_DONE=false;
  function injectCSS(){
    if(CSS_DONE) return; CSS_DONE=true;
    var s=document.createElement('style');
    s.setAttribute('data-vgl','');
    s.textContent =
    '.vgl-w,.vgl-w *{all:revert;box-sizing:border-box;margin:0;padding:0;'+
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;'+
      '-webkit-font-smoothing:antialiased}'+
    '.vgl-w{display:block;background:var(--vgl-bg);color:var(--vgl-fg);'+
      'border:1px solid var(--vgl-line);border-radius:var(--vgl-r);'+
      'padding:18px;max-width:420px;width:100%;line-height:1.45;'+
      'box-shadow:0 1px 2px rgba(15,14,12,.04),0 8px 28px -18px rgba(15,14,12,.22)}'+
    '.vgl-w svg{width:16px;height:16px;display:block;flex:none}'+
    '.vgl-hd{display:flex;align-items:center;gap:9px;margin-bottom:14px}'+
    '.vgl-mk{width:26px;height:26px;border-radius:7px;background:var(--vgl-acc);'+
      'color:var(--vgl-acc2);display:flex;align-items:center;justify-content:center;flex:none}'+
    '.vgl-mk svg{width:15px;height:15px}'+
    '.vgl-ht{font-size:13px;font-weight:700;letter-spacing:-.01em}'+
    '.vgl-hs{font-size:11px;color:var(--vgl-muted);font-weight:500}'+
    '.vgl-flex{display:flex;align-items:center;gap:10px}'+
    '.vgl-grow{flex:1;min-width:0}'+
    '.vgl-score{display:flex;align-items:flex-end;gap:8px;margin-bottom:12px}'+
    '.vgl-num{font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:.9;'+
      'font-variant-numeric:tabular-nums}'+
    '.vgl-of{font-size:13px;color:var(--vgl-muted);font-weight:600;padding-bottom:5px}'+
    '.vgl-band{margin-left:auto;font-size:10px;font-weight:800;letter-spacing:.07em;'+
      'text-transform:uppercase;color:#fff;padding:5px 9px;border-radius:6px;align-self:center}'+
    '.vgl-meter{display:flex;gap:3px;margin-bottom:14px}'+
    '.vgl-meter i{flex:1;height:5px;border-radius:3px;background:var(--vgl-line)}'+
    '.vgl-cats{display:flex;flex-direction:column;gap:1px;margin-bottom:14px}'+
    '.vgl-cat{display:flex;align-items:center;gap:9px;padding:7px 0;'+
      'border-top:1px solid var(--vgl-line);font-size:12.5px}'+
    '.vgl-cat:first-child{border-top:0}'+
    '.vgl-ci{width:22px;height:22px;border-radius:6px;background:var(--vgl-soft);'+
      'display:flex;align-items:center;justify-content:center;color:var(--vgl-muted)}'+
    '.vgl-ci svg{width:13px;height:13px}'+
    '.vgl-cn{flex:1;font-weight:600}'+
    '.vgl-cb{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;'+
      'color:#fff;padding:3px 7px;border-radius:5px}'+
    '.vgl-none{font-size:12.5px;color:var(--vgl-muted);padding:10px 0 14px}'+
    '.vgl-lead{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;'+
      'color:var(--vgl-acc);background:var(--vgl-soft);padding:7px 10px;'+
      'border-radius:8px;margin-bottom:14px}'+
    '.vgl-lead svg{width:13px;height:13px}'+
    '.vgl-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;'+
      'background:var(--vgl-acc);color:var(--vgl-acc2);font-size:13.5px;font-weight:700;'+
      'padding:12px 16px;border-radius:calc(var(--vgl-r) - 4px);border:0;cursor:pointer;'+
      'text-decoration:none;transition:opacity .15s ease}'+
    '.vgl-btn:hover{opacity:.9}.vgl-btn svg{width:15px;height:15px}'+
    '.vgl-ft{font-size:10px;color:var(--vgl-muted);text-align:center;margin-top:11px;'+
      'letter-spacing:.01em}'+
    /* checkout */
    '.vgl-co{display:flex;gap:12px;align-items:flex-start}'+
    '.vgl-cx{appearance:none;-webkit-appearance:none;width:20px;height:20px;flex:none;'+
      'border:1.5px solid var(--vgl-line);border-radius:6px;cursor:pointer;'+
      'background:var(--vgl-bg);position:relative;margin-top:1px;transition:.15s}'+
    '.vgl-cx:checked{background:var(--vgl-acc);border-color:var(--vgl-acc)}'+
    '.vgl-cx:checked::after{content:"";position:absolute;left:6px;top:2px;width:5px;'+
      'height:10px;border:solid var(--vgl-acc2);border-width:0 2px 2px 0;transform:rotate(45deg)}'+
    '.vgl-col{flex:1;min-width:0}'+
    '.vgl-cot{font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:8px;'+
      'flex-wrap:wrap}'+
    '.vgl-pill{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;'+
      'color:#fff;padding:3px 7px;border-radius:5px}'+
    '.vgl-cod{font-size:12px;color:var(--vgl-muted);margin:5px 0 11px}'+
    '.vgl-price{font-weight:800}'+
    '.vgl-msg{font-size:12.5px;color:var(--vgl-fg);display:flex;align-items:center;'+
      'gap:7px;padding:10px 0}'+
    '.vgl-msg svg{width:15px;height:15px;color:var(--vgl-acc)}'+
    /* sample link */
    '.vgl-samp{display:block;width:100%;text-align:center;background:none;border:0;'+
      'margin-top:10px;font-size:12px;font-weight:600;color:var(--vgl-muted);'+
      'cursor:pointer;padding:4px;text-decoration:underline;'+
      'text-underline-offset:2px;transition:color .15s}'+
    '.vgl-samp:hover{color:var(--vgl-acc)}'+
    /* modal */
    '.vgl-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(15,14,12,.55);'+
      'backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;'+
      'padding:20px;opacity:0;transition:opacity .18s}'+
    '.vgl-ov.in{opacity:1}'+
    '.vgl-md{background:var(--vgl-bg);color:var(--vgl-fg);width:100%;max-width:540px;'+
      'max-height:88vh;overflow:auto;border-radius:var(--vgl-r);'+
      'border:1px solid var(--vgl-line);box-shadow:0 24px 70px -20px rgba(15,14,12,.5);'+
      'transform:translateY(8px);transition:transform .18s}'+
    '.vgl-ov.in .vgl-md{transform:none}'+
    '.vgl-mh{display:flex;align-items:center;gap:10px;padding:18px 20px;'+
      'border-bottom:1px solid var(--vgl-line);position:sticky;top:0;background:var(--vgl-bg)}'+
    '.vgl-mh .vgl-mk{width:28px;height:28px}'+
    '.vgl-mt{font-size:14px;font-weight:800;flex:1}'+
    '.vgl-tag{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;'+
      'color:var(--vgl-acc);border:1px solid var(--vgl-acc);padding:3px 7px;border-radius:5px}'+
    '.vgl-x{background:none;border:0;color:var(--vgl-muted);cursor:pointer;'+
      'width:28px;height:28px;border-radius:7px;display:flex;align-items:center;'+
      'justify-content:center;flex:none}.vgl-x:hover{background:var(--vgl-soft)}'+
    '.vgl-x svg{width:16px;height:16px}'+
    '.vgl-mb{padding:18px 20px}'+
    '.vgl-sec{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;'+
      'color:var(--vgl-muted);margin:18px 0 9px}.vgl-sec:first-child{margin-top:0}'+
    '.vgl-sig{display:flex;align-items:center;gap:9px;padding:8px 0;'+
      'border-top:1px solid var(--vgl-line);font-size:12.5px}'+
    '.vgl-sig:first-of-type{border-top:0}.vgl-sig svg{width:14px;height:14px;color:var(--vgl-muted)}'+
    '.vgl-sg{flex:1;font-weight:600}'+
    '.vgl-vt{font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;'+
      'color:#fff;padding:3px 7px;border-radius:5px}'+
    '.vgl-meth{font-size:11.5px;color:var(--vgl-muted);line-height:1.55;'+
      'background:var(--vgl-soft);padding:11px 13px;border-radius:10px}'+
    '.vgl-dis{font-size:10.5px;color:var(--vgl-muted);text-align:center;margin-top:12px;'+
      'line-height:1.5}'+
    '@media (max-width:380px){.vgl-w{padding:15px}.vgl-num{font-size:34px}}';
    document.head.appendChild(s);
  }

  /* ─── Data ───────────────────────────────────────────────────────── */
  function fetchRisk(iso, cb){
    var url = API+'/risk?country='+iso.toUpperCase()+'&include_events=true';
    var x = new XMLHttpRequest();
    x.open('GET',url,true); x.timeout=6000;
    x.onload=function(){
      try{
        if(x.status>=200&&x.status<300){ cb(null, mapApi(iso, JSON.parse(x.responseText))); }
        else cb(new Error('http'),null);
      }catch(e){ cb(e,null); }
    };
    x.onerror=x.ontimeout=function(){ cb(new Error('net'),null); };
    x.send();
  }
  function mapApi(iso,j){
    var cr=j.composite_risk||{}, cb=j.category_breakdown||{};
    var cats=Object.keys(cb).map(function(k){
      return {key:k,score:cb[k].score||0,band:cb[k].band||'minimal'};
    }).filter(function(c){return c.score>0;})
      .sort(function(a,b){return b.score-a.score;});
    var lead=0;(j.events||[]).forEach(function(e){
      if((e.lead_time_hours||0)>lead) lead=e.lead_time_hours; });
    return { iso:iso.toUpperCase(), score:cr.score||0,
      band:cr.band||bandOf(cr.score||0), dominant:cr.dominant_category,
      cats:cats, lead:lead, generated:j.generated_at };
  }

  /* ─── DOM helpers ────────────────────────────────────────────────── */
  function E(tag,cls,html){ var e=document.createElement(tag);
    if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  function priceLabel(o){
    var sym = o.currency==='RUB'?'₽':o.currency==='EUR'?'€':'$';
    return o.currency==='RUB'? (o.price+' '+sym) : (sym+o.price);
  }
  function reportUrl(o){
    return REPORT+'?dest='+encodeURIComponent(o.dest)+'&lang='+o.lang+
      (o.partner?'&ref='+encodeURIComponent(o.partner):'')+
      '&price='+encodeURIComponent(o.price)+'&currency='+encodeURIComponent(o.currency);
  }

  /* ─── Widget: Smart-Card ─────────────────────────────────────────── */
  function renderSmartCard(host,o,d){
    var l=o.lang, w=E('div','vgl-w'); w.setAttribute('style',themeVars(o));
    var sc=(d.score||0), bd=d.band, bc=BAND_C[bd]||'#888';

    var hd=E('div','vgl-hd');
    hd.appendChild(E('div','vgl-mk',IC.shield));
    var ht=E('div','vgl-grow');
    ht.appendChild(E('div','vgl-ht',t(l,'sc_title')+' · '+cname(d.iso,l)));
    ht.appendChild(E('div','vgl-hs',t(l,'sc_sub')));
    hd.appendChild(ht);
    w.appendChild(hd);

    var srow=E('div','vgl-score');
    srow.appendChild(E('div','vgl-num',sc.toFixed(1)));
    srow.appendChild(E('div','vgl-of',t(l,'of5')));
    var band=E('div','vgl-band',(BAND_L[l]||BAND_L.en)[bd]);
    band.style.background=bc; srow.appendChild(band);
    w.appendChild(srow);

    var m=E('div','vgl-meter');
    for(var i=0;i<5;i++){ var seg=E('i');
      if(i<Math.round(sc)) seg.style.background=bc; m.appendChild(seg); }
    w.appendChild(m);

    if(d.cats.length){
      var cl=E('div','vgl-cats');
      d.cats.slice(0,4).forEach(function(c){
        var row=E('div','vgl-cat');
        row.appendChild(E('div','vgl-ci',IC[c.key]||IC.shield));
        row.appendChild(E('div','vgl-cn',(t(l,'cats')[c.key]||c.key)));
        var cbg=E('div','vgl-cb',(BAND_L[l]||BAND_L.en)[c.band]||c.band);
        cbg.style.background=BAND_C[c.band]||'#888';
        row.appendChild(cbg);
        cl.appendChild(row);
      });
      w.appendChild(cl);
    } else {
      w.appendChild(E('div','vgl-none',t(l,'none')));
    }

    if(d.lead>0){
      var ld=E('div','vgl-lead',IC.bolt+'<span>'+
        t(l,'lead').replace('{h}',d.lead)+'</span>');
      w.appendChild(ld);
    }

    var btn=E('a','vgl-btn',t(l,'cta_report')+IC.arrow);
    btn.href=reportUrl(o); btn.target='_blank'; btn.rel='noopener';
    w.appendChild(btn);
    w.appendChild(sampleLink(o,d,l));

    w.appendChild(E('div','vgl-ft',t(l,'src')));
    host.innerHTML=''; host.appendChild(w);
  }

  /* ─── Sample-report link + modal ─────────────────────────────────── */
  function sampleLink(o,d,l){
    var b=E('button','vgl-samp',t(l,'sample'));
    b.type='button';
    b.addEventListener('click',function(){ openSample(o,d,l); });
    return b;
  }
  function openSample(o,d,l){
    var sc=(d.score||0), bd=d.band, bc=BAND_C[bd]||'#888';
    var ov=E('div','vgl-ov'); ov.setAttribute('style',themeVars(o));
    ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
    var md=E('div','vgl-md');

    var mh=E('div','vgl-mh');
    mh.appendChild(E('div','vgl-mk',IC.shield));
    mh.appendChild(E('div','vgl-mt','Vigilo · '+t(l,'smp_title')+' · '+cname(d.iso,l)));
    mh.appendChild(E('span','vgl-tag',t(l,'smp_tag')));
    var x=E('button','vgl-x',IC.close||'<svg viewBox="0 0 24 24" fill="none" '+
      'stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>');
    x.type='button'; x.setAttribute('aria-label',t(l,'close'));
    mh.appendChild(x); md.appendChild(mh);

    var mb=E('div','vgl-mb');
    mb.appendChild(E('div','vgl-sec',t(l,'smp_overview')));
    var sr=E('div','vgl-score');
    sr.appendChild(E('div','vgl-num',sc.toFixed(1)));
    sr.appendChild(E('div','vgl-of',t(l,'of5')));
    var bn=E('div','vgl-band',(BAND_L[l]||BAND_L.en)[bd]); bn.style.background=bc;
    sr.appendChild(bn); mb.appendChild(sr);
    var mt=E('div','vgl-meter');
    for(var i=0;i<5;i++){var s=E('i'); if(i<Math.round(sc)) s.style.background=bc; mt.appendChild(s);}
    mb.appendChild(mt);

    mb.appendChild(E('div','vgl-sec',t(l,'smp_domains')));
    var cats=(d.cats&&d.cats.length)?d.cats.slice(0,5):
      [{key:'health',score:1.2,band:'low'},{key:'transport',score:0.6,band:'minimal'},
       {key:'climate',score:0.4,band:'minimal'}];
    var cl=E('div','vgl-cats');
    cats.forEach(function(c){
      var row=E('div','vgl-cat');
      row.appendChild(E('div','vgl-ci',IC[c.key]||IC.shield));
      row.appendChild(E('div','vgl-cn',(t(l,'cats')[c.key]||c.key)));
      var cb=E('div','vgl-cb',(BAND_L[l]||BAND_L.en)[c.band]||c.band);
      cb.style.background=BAND_C[c.band]||'#888'; row.appendChild(cb);
      cl.appendChild(row);
    });
    mb.appendChild(cl);

    mb.appendChild(E('div','vgl-sec',t(l,'smp_signals')));
    [['smp_sig1','smp_official','#5b9d6b'],['smp_sig2','smp_official','#5b9d6b'],
     ['smp_sig3','smp_ai','#e2820f']].forEach(function(s){
      var r=E('div','vgl-sig'); r.appendChild(E('div',null,IC.bolt));
      r.appendChild(E('div','vgl-sg',t(l,s[0])));
      var v=E('span','vgl-vt',t(l,s[1])); v.style.background=s[2];
      r.appendChild(v); mb.appendChild(r);
    });

    mb.appendChild(E('div','vgl-sec',t(l,'smp_method')));
    mb.appendChild(E('div','vgl-meth',t(l,'smp_methtxt')));

    var get=E('a','vgl-btn',
      t(l,'smp_get').replace('{p}',priceLabel(o))+IC.arrow);
    get.href=reportUrl(o); get.target='_blank'; get.rel='noopener';
    get.style.marginTop='18px'; mb.appendChild(get);
    mb.appendChild(E('div','vgl-dis',t(l,'smp_dis')));
    md.appendChild(mb); ov.appendChild(md);

    function close(){ ov.classList.remove('in');
      document.removeEventListener('keydown',esc);
      document.documentElement.style.overflow='';
      setTimeout(function(){ ov.remove(); },200); }
    function esc(e){ if(e.key==='Escape') close(); }
    x.addEventListener('click',close);
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    document.addEventListener('keydown',esc);
    document.documentElement.style.overflow='hidden';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('in'); x.focus(); });
  }

  /* ─── Widget: Checkout Upsell ────────────────────────────────────── */
  function renderCheckout(host,o,d){
    var l=o.lang, w=E('div','vgl-w'); w.setAttribute('style',themeVars(o));
    w.style.maxWidth='480px';
    var bd=d.band, bc=BAND_C[bd]||'#888', pl=priceLabel(o);

    var co=E('div','vgl-co');
    var cx=E('input','vgl-cx'); cx.type='checkbox'; cx.id='vgl-cx-'+Math.random().toString(36).slice(2,7);
    co.appendChild(cx);

    var col=E('div','vgl-col');
    var tt=E('label','vgl-cot'); tt.setAttribute('for',cx.id);
    tt.appendChild(E('span',null,t(l,'co_title')));
    var pill=E('span','vgl-pill',(BAND_L[l]||BAND_L.en)[bd]+' · '+cname(d.iso,l));
    pill.style.background=bc; tt.appendChild(pill);
    col.appendChild(tt);
    col.appendChild(E('div','vgl-cod',t(l,'co_desc').replace('{c}',cname(d.iso,l))));

    var btn=E('a','vgl-btn',
      '<span>'+t(l,'co_add').replace('{p}','<span class="vgl-price">'+pl+'</span>')+'</span>'+IC.arrow);
    btn.href='#';
    var added=false;
    function sync(){
      if(cx.checked){
        btn.innerHTML=IC.check+'<span>'+t(l,'co_added')+'</span>';
      } else {
        btn.innerHTML='<span>'+t(l,'co_add')
          .replace('{p}','<span class="vgl-price">'+pl+'</span>')+'</span>'+IC.arrow;
      }
    }
    cx.addEventListener('change',function(){ sync();
      // partner can listen: dispatch a CustomEvent with selection state
      host.dispatchEvent(new CustomEvent('vigilo:checkout',{bubbles:true,
        detail:{selected:cx.checked,dest:o.dest,price:o.price,currency:o.currency}}));
    });
    btn.addEventListener('click',function(e){
      if(cx.checked){ return; } // already added — let partner handle order
      e.preventDefault(); cx.checked=true; sync();
      host.dispatchEvent(new CustomEvent('vigilo:checkout',{bubbles:true,
        detail:{selected:true,dest:o.dest,price:o.price,currency:o.currency}}));
    });
    col.appendChild(btn);
    col.appendChild(sampleLink(o,d,l));
    co.appendChild(col);
    w.appendChild(co);
    w.appendChild(E('div','vgl-ft',t(l,'src')));
    host.innerHTML=''; host.appendChild(w);
  }

  /* ─── Mount ──────────────────────────────────────────────────────── */
  function parse(el){
    return {
      widget:(el.getAttribute('data-widget')||'smartcard').toLowerCase(),
      dest:(el.getAttribute('data-dest')||'').toUpperCase(),
      lang:el.getAttribute('data-lang')==='ru'?'ru':'en',
      theme:el.getAttribute('data-theme')==='dark'?'dark':'light',
      accent:el.getAttribute('data-accent')||'',
      accent2:el.getAttribute('data-accent-2')||'',
      bg:el.getAttribute('data-bg')||'',
      fg:el.getAttribute('data-fg')||'',
      radius:el.getAttribute('data-radius')||'md',
      partner:el.getAttribute('data-partner')||'',
      price:el.getAttribute('data-report-price')||'7',
      currency:el.getAttribute('data-currency')||'USD'
    };
  }
  function mount(host){
    var o=parse(host);
    if(!o.dest){ console.warn('[Vigilo] data-dest required'); return; }
    injectCSS();
    var w=E('div','vgl-w'); w.setAttribute('style',themeVars(o));
    w.appendChild(E('div','vgl-msg',IC.shield+'<span>'+t(o.lang,'loading')+'</span>'));
    host.innerHTML=''; host.appendChild(w);
    fetchRisk(o.dest,function(err,d){
      if(err||!d){
        host.innerHTML='';
        var e=E('div','vgl-w'); e.setAttribute('style',themeVars(o));
        e.appendChild(E('div','vgl-msg',IC.shield+'<span>'+t(o.lang,'err')+'</span>'));
        host.appendChild(e); return;
      }
      (o.widget==='checkout'?renderCheckout:renderSmartCard)(host,o,d);
    });
  }
  function init(){
    document.querySelectorAll(
      '[data-vigilo],.vigilo-widget,[id="vigilo-widget"]'
    ).forEach(mount);
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',init);
  else init();

  global.Vigilo={ version:'1.0', mount:mount,
    init:function(s){ var e=typeof s==='string'?document.querySelector(s):s;
      if(e) mount(e); } };
})(window);
