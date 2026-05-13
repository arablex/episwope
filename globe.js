/* =========================================================
   EpiScope v2 — refined globe + 2026 UI bindings
   ========================================================= */

/* ── i18n ────────────────────────────────────────────────── */
const LANG = window.EPISWOPE_LANG || 'en';

const STRINGS = {
  en: {
    outbreak:'Outbreak',
    cases:'cases',
    dataPrefix:'Data:',
    dataLoading:'loading…',
    confirmed:'Confirmed',
    deaths:'Deaths',
    severity:'Severity',
    surveyTitle:'Survey · 24h delta',
    newCases:'new cases',
    last24hSurv:'Last 24 hours · {region} surveillance',
    sevLabel:{ monitoring:'Monitor', low:'Low', warning:'Warning', alert:'Alert', critical:'Critical', catastrophic:'Catastrophic' },
    incubation:'Incubation',
    transmission:'Transmission',
    vaccLicensed:'✓ Vaccine licensed',
    vaccTrial:'⚗ In trial',
    vaccNone:'✗ No vaccine',
    active:'active',
    pages:'pages',
    noEvents:'No events logged in the last 24h.',
    liveInjected:'Injected {n} live events',
    liveUnavailable:'Live data unavailable:',
    riskTitle:'How dangerous is this for you?',
    riskTourist:'✈ Traveler to region',
    riskResident:'🏠 Local resident',
    riskHealthcare:'🏥 Healthcare worker',
    riskLow:'Low risk',
    riskMedium:'Moderate',
    riskHigh:'High risk',
    riskNote:'Based on transmission type and current severity level',
  },
  ru: {
    outbreak:'Вспышка',
    cases:'случаев',
    dataPrefix:'Данные:',
    dataLoading:'загрузка…',
    confirmed:'Подтверждено',
    deaths:'Смертей',
    severity:'Уровень',
    surveyTitle:'Мониторинг · дельта 24ч',
    newCases:'новых случаев',
    last24hSurv:'Последние 24 часа · {region}',
    sevLabel:{ monitoring:'Монит.', low:'Низкий', warning:'Внимание', alert:'Алерт', critical:'Критич.', catastrophic:'Катастрофа' },
    incubation:'Инкубация',
    transmission:'Передача',
    vaccLicensed:'✓ Вакцина одобрена',
    vaccTrial:'⚗ В испытании',
    vaccNone:'✗ Вакцины нет',
    active:'активно',
    pages:'стр.',
    noEvents:'Событий за последние 24ч не зафиксировано.',
    liveInjected:'Загружено {n} событий',
    liveUnavailable:'Данные недоступны:',
    riskTitle:'Насколько это опасно для вас?',
    riskTourist:'✈ Турист в регионе',
    riskResident:'🏠 Местный житель',
    riskHealthcare:'🏥 Медработник',
    riskLow:'Низкий риск',
    riskMedium:'Умеренный',
    riskHigh:'Высокий риск',
    riskNote:'На основе типа передачи и текущего уровня угрозы',
  }
};

function T(key, vars){
  const s = STRINGS[LANG] || STRINGS.en;
  let str = s[key] ?? (STRINGS.en[key] ?? key);
  if(vars) Object.entries(vars).forEach(([k,v]) => { str = str.replace(`{${k}}`, v); });
  return str;
}

/* ── Disease name translations ───────────────────────────── */
const DISEASE_RU = {
  'Ebola Sudan-virus':'Эбола (вирус Судана)',
  'Dengue (DENV-2)':'Денге (DENV-2)',
  'Cholera (O1)':'Холера (O1)',
  'H5N1 avian influenza':'Птичий грипп H5N1',
  'Yellow Fever':'Жёлтая лихорадка',
  'Meningitis (NmC)':'Менингит (NmC)',
  'Lassa Fever':'Лихорадка Ласса',
  'Mpox (clade Ib)':'Оспа обезьян (клада Ib)',
  'Malaria (P. falciparum)':'Малярия (P. falciparum)',
  'Typhoid (XDR)':'Тиф XDR (резистентный)',
  'Rabies (canine variant)':'Бешенство (собачий)',
  'Crimean–Congo HF':'Крымско-Конго ГЛ',
  'Mpox':'Оспа обезьян',
  'Dengue':'Денге',
  'Cholera':'Холера',
  'Measles':'Корь',
  'Lassa Fever':'Лихорадка Ласса',
  'West Nile Virus':'Вирус Западного Нила',
  'Polio':'Полиомиелит',
  'Marburg Virus':'Вирус Марбург',
  'H5N1 Influenza':'Грипп H5N1',
  'Yellow Fever':'Жёлтая лихорадка',
  'Malaria':'Малярия',
};
function diseaseName(name){ return LANG === 'ru' ? (DISEASE_RU[name] || name) : name; }

/* ── Risk profiles ───────────────────────────────────────── */
// Keys matched with .includes() against lowercased disease name
const DISEASE_RISK_PROFILES = [
  // bloodborne / contact — low tourist, high healthcare
  { keys:['ebola','marburg'],            t:'low',    r:'high',   h:'high'   },
  { keys:['lassa','cchf','crimean'],     t:'low',    r:'medium', h:'high'   },
  { keys:['mpox'],                       t:'low',    r:'medium', h:'medium' },
  // vector-borne — medium tourist (exposure via mosquito/tick)
  { keys:['dengue','malaria','yellow fever'],  t:'medium', r:'high',   h:'medium' },
  { keys:['west nile'],                  t:'low',    r:'medium', h:'low'    },
  // airborne / droplet — higher tourist risk
  { keys:['measles'],                    t:'medium', r:'high',   h:'high'   },
  { keys:['meningitis'],                 t:'low',    r:'medium', h:'high'   },
  { keys:['h5n1','avian influenza'],     t:'low',    r:'medium', h:'high'   },
  // fecal-oral
  { keys:['cholera','typhoid'],          t:'medium', r:'high',   h:'medium' },
  { keys:['polio'],                      t:'low',    r:'medium', h:'medium' },
  // other
  { keys:['rabies'],                     t:'low',    r:'medium', h:'medium' },
];

function computeRisk(o){
  const name = (o.name || o.disease || '').toLowerCase();
  let base = {t:'low', r:'medium', h:'medium'};
  for(const p of DISEASE_RISK_PROFILES){
    if(p.keys.some(k => name.includes(k))){ base = p; break; }
  }
  const levels = ['low','medium','high'];
  const sevBoost = {monitoring:-1, low:0, warning:0, alert:1, critical:1};
  const boost = sevBoost[o.sev] ?? 0;
  const adj = l => levels[Math.max(0, Math.min(2, levels.indexOf(l) + boost))];
  return { tourist: adj(base.t), resident: adj(base.r), healthcare: adj(base.h) };
}

const SEV = {
  monitoring:  { idx:0, color:'#A09F95', dark:'#807E76', light:'#B8B7AD', label: STRINGS[LANG]?.sevLabel?.monitoring || 'Monitor' },
  low:         { idx:1, color:'#E4B514', dark:'#B28A0E', light:'#F2C73D', label: STRINGS[LANG]?.sevLabel?.low || 'Low' },
  warning:     { idx:2, color:'#E8590C', dark:'#B84408', light:'#F47521', label: STRINGS[LANG]?.sevLabel?.warning || 'Warning' },
  alert:       { idx:3, color:'#C92A2A', dark:'#9F1F1F', light:'#E03A3A', label: STRINGS[LANG]?.sevLabel?.alert || 'Alert' },
  critical:    { idx:4, color:'#8B1A1A', dark:'#6E1414', light:'#A02222', label: STRINGS[LANG]?.sevLabel?.critical || 'Critical' },
  catastrophic:{ idx:5, color:'#5C2010', dark:'#421710', light:'#7A2A18', label: STRINGS[LANG]?.sevLabel?.catastrophic || 'Catastrophic' },
};

const OUTBREAKS = [
  { id:'ebola-uganda',     code:'EPI-2026-UGA-0142', name:'Ebola Sudan-virus',
    pathogen:'Sudan ebolavirus', country:'Uganda', iso:800, region:'AFRO',
    place:'Mubende District, Uganda', lat:0.572,  lon:31.394,
    sev:'critical', who:'Grade 3 · PHEIC pending', cases:142, deaths:38, cfr:26.8, rt:1.84,
    new24:19, sevIdx:84,
    trend:[3,5,4,8,11,9,14,16,15,19,22,18,24,19],
    blurb:'Cluster expanding from Mubende into Kassanda and Kyegegwa districts. Genomic surveillance confirms Sudan-virus clade, distinct from 2022 lineage. CFR running near 27% with 6 nosocomial transmissions flagged. WHO mission deploying; cross-border watch on Kenyan and Tanzanian boundaries.',
    blurb_ru:'Кластер расширяется из Мубенде в районы Кассанда и Кьегегва. Геномный надзор подтверждает вирус Судана — отличный от штамма 2022 года. Летальность около 27%, выявлено 6 внутрибольничных случаев. ВОЗ направляет миссию, усилен контроль на границах с Кенией и Танзанией.',
    events:[
      {when:'14:18', what:'<b>Genomic match</b> — Sudan clade C, distant from Mubende-2022', ct:'+2'},
      {when:'12:04', what:'<b>WHO mission</b> deploying — Kampala field office', ct:''},
      {when:'09:51', what:'New cluster — <b>Kassanda</b> district (3 cases)', ct:'+3'},
      {when:'08:30', what:'Border health screen activated — Busia, Malaba', ct:''},
    ]
  },
  { id:'dengue-brazil',    code:'EPI-2026-BRA-0098', name:'Dengue (DENV-2)',
    pathogen:'Dengue virus serotype 2', country:'Brazil', iso:76, region:'AMRO',
    place:'Minas Gerais & São Paulo, Brazil', lat:-14.235, lon:-51.925,
    sev:'alert', who:'Regional emergency · PAHO', cases:2_420_117, deaths:1_184, cfr:0.05, rt:1.21,
    new24:38_410, sevIdx:72,
    trend:[180,210,260,330,420,560,780,1100,1450,1820,2240,2480,2710,3120],
    blurb:'Record season — DENV-2 dominant after 4 years of DENV-1 cycling. Hospitalisations doubled in Minas Gerais; Aedes albopictus indices remain in the high-risk band through Q2.',
    blurb_ru:'Рекордный сезон — доминирует DENV-2 после 4 лет цикла DENV-1. Госпитализации удвоились в Минас-Жерайс. Индекс комаров Aedes albopictus остаётся в зоне высокого риска до конца Q2.',
    events:[
      {when:'13:55', what:'<b>São Paulo</b> declares public health emergency', ct:''},
      {when:'11:20', what:'Hospitalisations up <b>+22%</b> WoW', ct:'+22%'},
      {when:'07:10', what:'Insecticide rotation initiated — pyrethroid → organophosphate', ct:''},
    ]
  },
  { id:'cholera-sudan',    code:'EPI-2026-SDN-0061', name:'Cholera (O1)',
    pathogen:'V. cholerae O1 El Tor', country:'Sudan', iso:729, region:'EMRO',
    place:'Gedaref & Kassala, Sudan', lat:14.792, lon:35.420,
    sev:'alert', who:'Grade 2', cases:45_212, deaths:1_103, cfr:2.4, rt:1.41,
    new24:880, sevIdx:68,
    trend:[120,180,240,310,400,520,640,780,860,940,1020,1080,1140,1280],
    blurb:'Outbreak following displacement waves into eastern states. Water and sanitation infrastructure compromised; OCV campaign authorised — 2.1M doses requested via ICG.',
    blurb_ru:'Вспышка на фоне волн вынужденного переселения. Водопроводная инфраструктура повреждена. Запущена кампания оральной вакцинации против холеры — запрошено 2,1 млн доз через ICG.',
    events:[
      {when:'13:02', what:'OCV stockpile request — <b>2.1M doses</b>', ct:''},
      {when:'10:11', what:'Gedaref camp positivity at <b>14%</b>', ct:'14%'},
    ]
  },
  { id:'h5n1-vietnam',     code:'EPI-2026-VNM-0017', name:'H5N1 avian influenza',
    pathogen:'Influenza A(H5N1) clade 2.3.4.4b', country:'Vietnam', iso:704, region:'WPRO',
    place:'Đồng Tháp & An Giang, Vietnam', lat:10.495, lon:105.633,
    sev:'warning', who:'Grade 2 · Zoonotic', cases:6, deaths:2, cfr:33.3, rt:0.4,
    new24:1, sevIdx:48,
    trend:[0,0,1,0,1,0,0,1,1,0,1,0,1,1],
    blurb:'Two human cases linked to backyard poultry. No evidence of human-to-human transmission. Mekong delta poultry markets under enhanced surveillance.',
    blurb_ru:'Два случая у людей, связанных с домашней птицей. Признаков передачи от человека к человеку нет. Рынки птицы в дельте Меконга под усиленным надзором.',
    events:[
      {when:'12:40', what:'2nd <b>human case</b> — 47M, Đồng Tháp', ct:'+1'},
      {when:'09:00', what:'Poultry cull — 18,400 birds', ct:''},
    ]
  },
  { id:'yf-nigeria',       code:'EPI-2026-NGA-0044', name:'Yellow Fever',
    pathogen:'YFV (Flavivirus)', country:'Nigeria', iso:566, region:'AFRO',
    place:'Bauchi & Plateau States, Nigeria', lat:10.0, lon:9.0,
    sev:'warning', who:'Grade 2', cases:8_241, deaths:172, cfr:2.1, rt:1.12,
    new24:96, sevIdx:54,
    trend:[40,55,62,71,80,95,110,124,138,144,160,175,182,190],
    blurb:'Reactive vaccination underway in 14 LGAs. 1.4M doses deployed; coverage at 71% of target population. Sylvatic cycle confirmed in Plateau.',
    blurb_ru:'Реактивная вакцинация в 14 округах. Развёрнуто 1,4 млн доз, охват 71% целевого населения. Лесной цикл передачи подтверждён в штате Плато.',
    events:[ {when:'11:45', what:'Reactive vax — <b>1.4M doses</b> deployed', ct:''} ]
  },
  { id:'mening-niger',     code:'EPI-2026-NER-0029', name:'Meningitis (NmC)',
    pathogen:'Neisseria meningitidis C', country:'Niger', iso:562, region:'AFRO',
    place:'Niamey & Tillabéri, Niger', lat:14.0, lon:5.0,
    sev:'alert', who:'Grade 2 · Belt season', cases:4_812, deaths:241, cfr:5.0, rt:1.33,
    new24:212, sevIdx:65,
    trend:[60,90,120,160,200,240,280,300,340,380,400,420,440,470],
    blurb:'Meningitis belt seasonal surge — NmC predominant. Mass vaccination triggered above attack-rate threshold. ICG dispatch of 1.8M doses confirmed.',
    blurb_ru:'Сезонный подъём в зоне менингитного пояса — доминирует NmC. Запущена массовая вакцинация после превышения порогового уровня атаки. ICG подтвердил поставку 1,8 млн доз.',
    events:[]
  },
  { id:'lassa-sl',         code:'EPI-2026-SLE-0011', name:'Lassa Fever',
    pathogen:'Lassa virus (Arenaviridae)', country:'Sierra Leone', iso:694, region:'AFRO',
    place:'Kenema District, Sierra Leone', lat:7.876, lon:-11.190,
    sev:'warning', who:'Grade 1', cases:1_204, deaths:118, cfr:9.8, rt:1.05,
    new24:14, sevIdx:46,
    trend:[8,9,10,12,11,14,15,12,13,15,14,16,15,14],
    blurb:'Endemic season uptick — Mastomys reservoir control intensified in Kenema. KGH treatment centre at 78% capacity.',
    blurb_ru:'Сезонный подъём в эндемичном районе — усилен контроль над резервуаром Mastomys в Кенема. Лечебный центр KGH заполнен на 78%.',
    events:[]
  },
  { id:'mpox-drc',         code:'EPI-2026-COD-0073', name:'Mpox (clade Ib)',
    pathogen:'Monkeypox virus clade Ib', country:'DR Congo', iso:180, region:'AFRO',
    place:'Sud-Kivu & Équateur, DRC', lat:-4.038, lon:21.759,
    sev:'warning', who:'Grade 3 · PHEIC active', cases:15_840, deaths:642, cfr:4.0, rt:1.18,
    new24:284, sevIdx:62,
    trend:[120,140,160,190,210,230,260,280,300,310,340,360,380,400],
    blurb:'Clade Ib expansion through eastern provinces. Sexual transmission chain confirmed; pediatric case-share 38%. MVA-BN doses being airlifted to Goma.',
    blurb_ru:'Расширение клады Ib через восточные провинции. Подтверждена половая цепочка передачи; 38% случаев — дети. Вакцина MVA-BN доставляется в Гому воздухом.',
    events:[]
  },
  { id:'malaria-moz',      code:'EPI-2026-MOZ-0052', name:'Malaria (P. falciparum)',
    pathogen:'Plasmodium falciparum', country:'Mozambique', iso:508, region:'AFRO',
    place:'Zambezia Province, Mozambique', lat:-17.0, lon:36.5,
    sev:'alert', who:'Grade 1', cases:184_220, deaths:412, cfr:0.22, rt:1.08,
    new24:6_840, sevIdx:60,
    trend:[420,520,610,720,840,960,1080,1200,1320,1420,1520,1620,1700,1820],
    blurb:'Post-cyclone surge — ITN coverage gap in Zambezia under reactive distribution. RDT positivity peak 41% in week 18.',
    blurb_ru:'Подъём после циклона — дефицит обработанных противомоскитных сеток в Замбезии, ведётся реактивная раздача. Позитивность RDT-теста достигла 41% на 18-й неделе.',
    events:[]
  },
  { id:'typhoid-pak',      code:'EPI-2026-PAK-0036', name:'Typhoid (XDR)',
    pathogen:'S. Typhi H58 XDR', country:'Pakistan', iso:586, region:'EMRO',
    place:'Sindh Province, Pakistan', lat:25.0, lon:68.5,
    sev:'warning', who:'Grade 2', cases:12_104, deaths:88, cfr:0.7, rt:1.16,
    new24:182, sevIdx:50,
    trend:[40,55,72,89,110,130,150,162,178,192,210,224,236,250],
    blurb:'Extensively drug-resistant typhoid clones circulating in urban Sindh. Typbar-TCV catch-up campaign at 64% coverage.',
    blurb_ru:'Штаммы тифа с множественной лекарственной устойчивостью (XDR) циркулируют в городах провинции Синд. Охват кампанией вакцинации Typbar-TCV составляет 64%.',
    events:[]
  },
  { id:'rabies-india',     code:'EPI-2026-IND-0028', name:'Rabies (canine variant)',
    pathogen:'Rabies lyssavirus', country:'India', iso:356, region:'SEARO',
    place:'Tamil Nadu & Karnataka, India', lat:13.0, lon:78.0,
    sev:'monitoring', who:'Endemic surveillance', cases:2_104, deaths:1_842, cfr:87.5, rt:0,
    new24:18, sevIdx:34,
    trend:[15,12,14,16,15,18,14,17,16,19,18,17,16,18],
    blurb:'Endemic reporting unchanged WoW. PEP availability stable across 92% of community health centres. Animal-bite registry digitisation now at 14 states.',
    blurb_ru:'Эндемичный уровень без изменений. Доступность постэкспозиционной профилактики (ПЭП) стабильна в 92% медпунктов. Реестр укусов животных оцифрован в 14 штатах.',
    events:[]
  },
  { id:'cchf-kaz',         code:'EPI-2026-KAZ-0009', name:'Crimean–Congo HF',
    pathogen:'CCHF virus (Nairoviridae)', country:'Kazakhstan', iso:398, region:'EURO',
    place:'Kyzylorda & Turkistan, Kazakhstan', lat:44.0, lon:67.0,
    sev:'monitoring', who:'Seasonal surveillance', cases:312, deaths:24, cfr:7.7, rt:0.9,
    new24:4, sevIdx:30,
    trend:[2,3,2,4,3,5,4,3,2,4,5,3,4,4],
    blurb:'Hyalomma tick season opening. Livestock holders advised on PPE. No nosocomial chains detected.',
    blurb_ru:'Открытие сезона клещей Hyalomma. Животноводам рекомендованы средства индивидуальной защиты. Внутрибольничных цепочек передачи не выявлено.',
    events:[]
  },
];

const HIGHLIGHT_ISO = new Set(OUTBREAKS.map(o=>o.iso));

/* =========================================================
   STATE
   ========================================================= */
const stage   = document.getElementById('stage');
const canvas  = document.getElementById('globe');
const ctx     = canvas.getContext('2d');

const state = {
  rotation: [-22, -8, 0],
  scale: 1,
  autoRotate: true,
  filter: 'all',
  query: '',
  selectedId: 'ebola-uganda',
  hoveredId: null,
  countries: [],
  dpr: Math.min(2, window.devicePixelRatio || 1),
  cssW:0, cssH:0,
  cx:0, cy:0, R:0,
  dragging:false, drag:null,
  t:0,
  stars:[],          // background dust dots
};

const projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
const path = d3.geoPath(projection, ctx);

/* =========================================================
   RESIZE
   ========================================================= */
function resize(){
  const r = stage.getBoundingClientRect();
  state.cssW = r.width; state.cssH = r.height;
  canvas.width  = Math.round(r.width  * state.dpr);
  canvas.height = Math.round(r.height * state.dpr);
  canvas.style.width = r.width+'px';
  canvas.style.height = r.height+'px';
  ctx.setTransform(state.dpr,0,0,state.dpr,0,0);

  state.cx = r.width/2;
  state.cy = r.height/2 + 6;
  state.R  = Math.min(r.width, r.height) * 0.39 * state.scale;
  projection.translate([state.cx, state.cy]).scale(state.R).rotate(state.rotation);

  // regenerate background dust dots
  state.stars = [];
  const n = 90;
  for(let i=0;i<n;i++){
    state.stars.push({
      x: Math.random()*r.width,
      y: Math.random()*r.height,
      r: 0.4 + Math.random()*1.3,
      a: 0.05 + Math.random()*0.20,
    });
  }
}
window.addEventListener('resize', ()=>{ resize(); });

/* =========================================================
   GLOBE RENDER
   ========================================================= */
function drawBackdrop(){
  const {cx,cy,R} = state;

  // soft ground shadow elliptical
  ctx.save();
  ctx.translate(cx, cy + R*0.96);
  ctx.scale(1, 0.18);
  const sh = ctx.createRadialGradient(0,0, 1, 0,0, R*1.1);
  sh.addColorStop(0,'rgba(40,32,20,0.32)');
  sh.addColorStop(1,'rgba(40,32,20,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(0,0, R*1.05, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // dust / star points
  for(const s of state.stars){
    const d = Math.hypot(s.x-cx, s.y-cy);
    if(d < R*1.05) continue;             // skip those overlapping sphere
    ctx.fillStyle = `rgba(60,55,40,${s.a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  }
}

function drawAtmosphere(){
  const {cx,cy,R} = state;
  // outer atmosphere glow — soft warm pearl gradient
  const g = ctx.createRadialGradient(cx, cy, R*0.96, cx, cy, R*1.42);
  g.addColorStop(0,'rgba(255,250,235,0.55)');
  g.addColorStop(0.30,'rgba(232,89,12,0.10)');
  g.addColorStop(0.65,'rgba(232,89,12,0.04)');
  g.addColorStop(1,'rgba(232,89,12,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R*1.42, 0, Math.PI*2); ctx.fill();

  // tighter inner atmospheric rim (cool blue tint, just outside the sphere)
  const g2 = ctx.createRadialGradient(cx, cy, R*0.99, cx, cy, R*1.07);
  g2.addColorStop(0,'rgba(180,200,235,0.42)');
  g2.addColorStop(1,'rgba(180,200,235,0)');
  ctx.fillStyle = g2;
  ctx.beginPath(); ctx.arc(cx, cy, R*1.10, 0, Math.PI*2); ctx.fill();
}

function drawSphere(){
  const {cx,cy,R} = state;
  // sphere base — pearl with subtle warm core
  const g = ctx.createRadialGradient(cx-R*0.30, cy-R*0.40, R*0.05, cx+R*0.15, cy+R*0.10, R*1.10);
  g.addColorStop(0,   '#FFFEFA');
  g.addColorStop(0.30,'#F6F1E6');
  g.addColorStop(0.70,'#E4DCC9');
  g.addColorStop(1,   '#CCC1A8');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
}

function drawGraticule(){
  // grid: 15° base, 30° slightly bolder, equator + prime meridian heavier
  ctx.save();

  // base 15° grid — very faint
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = 'rgba(56,48,34,0.10)';
  const fine = d3.geoGraticule().step([15,15]);
  ctx.beginPath(); path(fine()); ctx.stroke();

  // 30° grid — a touch heavier
  ctx.lineWidth = 0.55;
  ctx.strokeStyle = 'rgba(56,48,34,0.16)';
  const med = d3.geoGraticule().step([30,30]);
  ctx.beginPath(); path(med()); ctx.stroke();

  // equator + prime meridian
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(56,48,34,0.26)';
  const eq = d3.geoGraticule().stepMajor([90,360]).stepMinor([360,360]);
  ctx.beginPath(); path(eq()); ctx.stroke();

  ctx.restore();
}

function drawCountries(){
  if(!state.countries.length) return;
  const sel = currentSel();
  const selectedIso = sel?.iso || null;
  const hoverIso    = (state.hoveredId && OUTBREAKS.find(o=>o.id===state.hoveredId)?.iso) || null;
  const sevColor    = sel ? SEV[sel.sev].color : '#E8590C';
  const sevDark     = sel ? SEV[sel.sev].dark  : '#B84408';

  ctx.save();
  ctx.lineJoin = 'round';

  // pass 1: base fills
  for(const feat of state.countries){
    const iso = +feat.id;
    let fill, stroke, lw;
    if(iso === selectedIso){
      fill = hexA(sevColor, 0.82); stroke = hexA(sevDark, 0.95); lw = 1.1;
    } else if(iso === hoverIso){
      fill = hexA('#E8590C', 0.32); stroke = hexA('#B84408', 0.55); lw = 0.75;
    } else if(HIGHLIGHT_ISO.has(iso)){
      fill = 'rgba(108,98,80,0.46)'; stroke = 'rgba(40,30,18,0.32)'; lw = 0.55;
    } else {
      fill = 'rgba(150,140,118,0.38)'; stroke = 'rgba(40,30,18,0.26)'; lw = 0.55;
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath(); path(feat); ctx.fill(); ctx.stroke();
  }

  // pass 2: contour-line texture — short dashed inner stroke for a topo-map feel
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = 'rgba(40,30,18,0.10)';
  ctx.lineWidth = 0.32;
  ctx.setLineDash([1.6, 2.4]);
  for(const feat of state.countries){
    ctx.beginPath(); path(feat); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // pass 3: bright outline on the selected country
  if(selectedIso){
    const feat = state.countries.find(f => +f.id === selectedIso);
    if(feat){
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = hexA(sevDark, 1);
      ctx.beginPath(); path(feat); ctx.stroke();
      // inner glow
      ctx.lineWidth = 4;
      ctx.strokeStyle = hexA(sevColor, 0.18);
      ctx.beginPath(); path(feat); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLight(){
  const {cx,cy,R} = state;
  // bright specular highlight top-left
  const sp = ctx.createRadialGradient(cx-R*0.58, cy-R*0.55, 1, cx-R*0.58, cy-R*0.55, R*0.95);
  sp.addColorStop(0,'rgba(255,255,255,0.55)');
  sp.addColorStop(0.45,'rgba(255,255,255,0.10)');
  sp.addColorStop(1,'rgba(255,255,255,0)');
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
  ctx.fillStyle = sp;
  ctx.fillRect(cx-R, cy-R, R*2, R*2);

  // shadow side bottom-right
  const shd = ctx.createRadialGradient(cx+R*0.50, cy+R*0.55, R*0.15, cx+R*0.55, cy+R*0.55, R*1.10);
  shd.addColorStop(0,'rgba(20,16,10,0)');
  shd.addColorStop(1,'rgba(20,16,10,0.28)');
  ctx.fillStyle = shd;
  ctx.fillRect(cx-R, cy-R, R*2, R*2);
  ctx.restore();

  // bright rim
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(cx,cy,R-0.4,0,Math.PI*2); ctx.stroke();
  // outer thin warm edge
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(232,89,12,0.30)';
  ctx.beginPath(); ctx.arc(cx,cy,R+0.6,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

/* =========================================================
   MARKERS
   ========================================================= */
function projectOutbreak(o){
  const p = projection([o.lon, o.lat]);
  if(!p) return null;
  const c = d3.geoDistance([o.lon,o.lat], [-state.rotation[0], -state.rotation[1]]);
  const visible = c < Math.PI/2 - 0.02;
  return { x:p[0], y:p[1], visible, c };
}

function caseRadius(o){
  const r = 10 + Math.log10(Math.max(10,o.cases)) * 11;
  return r * (0.85 + 0.25*state.scale);
}

function drawMarkers(){
  const sel = currentSel();
  const t = state.t;

  const list = OUTBREAKS
    .filter(o => state.filter==='all' || o.sev===state.filter)
    .map(o => ({o, p:projectOutbreak(o)}))
    .filter(d => d.p && d.p.visible)
    .sort((a,b) => (a.o.id===sel?.id?1:0) - (b.o.id===sel?.id?1:0));

  // halos — radial soft glow
  for(const {o,p} of list){
    const r = caseRadius(o);
    const col = SEV[o.sev].color;
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r*2.6);
    g.addColorStop(0, hexA(col, 0.30));
    g.addColorStop(0.35, hexA(col, 0.16));
    g.addColorStop(0.7, hexA(col, 0.06));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r*2.6, 0, Math.PI*2); ctx.fill();
  }

  // pulsing rings — critical / selected
  for(const {o,p} of list){
    const isCritical = o.sev==='critical' || o.sev==='catastrophic';
    const isSel = sel && sel.id===o.id;
    if(!isCritical && !isSel) continue;
    const r = caseRadius(o);
    const ph = (Math.sin(t*0.0035 + r) + 1)/2;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexA(SEV[o.sev].color, Math.max(0, 0.55 - ph*0.5));
    ctx.beginPath(); ctx.arc(p.x, p.y, r*(1.10 + ph*0.65), 0, Math.PI*2); ctx.stroke();

    const ph2 = ((Math.sin(t*0.0035 + r + 1.8)) + 1)/2;
    ctx.strokeStyle = hexA(SEV[o.sev].color, Math.max(0, 0.45 - ph2*0.4));
    ctx.beginPath(); ctx.arc(p.x, p.y, r*(1.10 + ph2*0.35), 0, Math.PI*2); ctx.stroke();

    // selected: rotating dashed ring
    if(isSel){
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((t*0.0006) % (Math.PI*2));
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = hexA('#161513', 0.55);
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(0,0, r*1.55, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // center dots
  for(const {o,p} of list){
    const isSel = sel && sel.id===o.id;
    const r = isSel ? 7 : 5;
    // outer white halo
    ctx.beginPath(); ctx.arc(p.x, p.y, r+3.6, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    // colored dot with subtle gradient
    const g = ctx.createRadialGradient(p.x - r*0.3, p.y - r*0.3, 0.5, p.x, p.y, r);
    g.addColorStop(0, SEV[o.sev].light);
    g.addColorStop(1, SEV[o.sev].color);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    // dark ring on selected
    if(isSel){
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#161513';
      ctx.beginPath(); ctx.arc(p.x, p.y, r+3.8, 0, Math.PI*2); ctx.stroke();
    }
  }
}

function hexA(h, a){
  const r = parseInt(h.slice(1,3),16);
  const g = parseInt(h.slice(3,5),16);
  const b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* =========================================================
   FRAME LOOP
   ========================================================= */
function frame(ts){
  state.t = ts;
  if(state.autoRotate && !state.dragging){
    state.rotation[0] = (state.rotation[0] + 0.05) % 360;
    projection.rotate(state.rotation);
  }
  ctx.clearRect(0,0,state.cssW,state.cssH);
  drawBackdrop();
  drawAtmosphere();
  drawSphere();
  drawCountries();
  drawGraticule();
  drawLight();
  drawMarkers();
  positionPopup();
  updateClock();
  requestAnimationFrame(frame);
}

/* =========================================================
   POPUP positioning
   ========================================================= */
const popup = document.getElementById('popup');
function positionPopup(){
  const sel = currentSel();
  if(!sel){ popup.classList.remove('is-on'); return; }
  const p = projectOutbreak(sel);
  if(!p || !p.visible){ popup.classList.remove('is-on'); return; }
  popup.classList.add('is-on');
  const w = popup.offsetWidth, h = popup.offsetHeight;
  let x = p.x, y = p.y - 26;
  const pad = 16;
  if(x - w/2 < pad) x = w/2 + pad;
  if(x + w/2 > state.cssW - pad) x = state.cssW - pad - w/2;
  if(y - h < pad) y = p.y + h + 36;
  popup.style.left = x+'px';
  popup.style.top  = y+'px';
}

function updateClock(){
  document.getElementById('lat').textContent = fmtDeg(-state.rotation[1], 'NS');
  document.getElementById('lon').textContent = fmtDeg(-state.rotation[0], 'EW');
  document.getElementById('zo').textContent  = state.scale.toFixed(2)+'×';
}
function fmtDeg(v, ax){
  const sign = v>=0 ? (ax[0]) : (ax[1]);
  return ` ${sign} ${Math.abs(v).toFixed(2)}°`;
}

/* =========================================================
   INTERACTIONS
   ========================================================= */
canvas.addEventListener('pointerdown', e=>{
  state.dragging = true;
  state.drag = { x:e.clientX, y:e.clientY, rot:[...state.rotation] };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e=>{
  if(state.dragging){
    const dx = e.clientX - state.drag.x;
    const dy = e.clientY - state.drag.y;
    const k = 0.35 / Math.max(0.5, state.scale);
    state.rotation[0] = state.drag.rot[0] + dx*k;
    state.rotation[1] = clamp(state.drag.rot[1] - dy*k, -88, 88);
    projection.rotate(state.rotation);
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let best=null, bd=14;
  for(const o of OUTBREAKS){
    const p = projectOutbreak(o); if(!p || !p.visible) continue;
    const d = Math.hypot(p.x-mx, p.y-my);
    if(d < bd){ bd = d; best = o.id; }
  }
  if(best !== state.hoveredId){
    state.hoveredId = best;
    canvas.style.cursor = best ? 'pointer' : 'grab';
  }
});
canvas.addEventListener('pointerup', e=>{
  if(state.dragging){
    const moved = Math.hypot(e.clientX-state.drag.x, e.clientY-state.drag.y);
    state.dragging = false;
    if(moved < 4) handleClick(e);
  }
});
canvas.addEventListener('pointerleave', ()=>{ state.dragging=false; state.hoveredId=null; });

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const k = Math.pow(1.0015, -e.deltaY);
  setScale(state.scale * k);
}, {passive:false});

function handleClick(e){
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let best=null, bd=20;
  for(const o of OUTBREAKS){
    const p = projectOutbreak(o); if(!p || !p.visible) continue;
    const d = Math.hypot(p.x-mx, p.y-my);
    if(d < bd){ bd = d; best = o.id; }
  }
  if(best){ selectOutbreak(best); }
}

document.getElementById('zIn').onclick     = ()=> setScale(state.scale*1.25);
document.getElementById('zOut').onclick    = ()=> setScale(state.scale/1.25);
document.getElementById('zRecenter').onclick = ()=>{
  state.scale = 1; resize();
  flyTo(currentSel());
};
const togRot = document.getElementById('togRot');
togRot.onclick = ()=>{
  state.autoRotate = !state.autoRotate;
  togRot.classList.toggle('is-on', state.autoRotate);
};

function setScale(s){ state.scale = clamp(s, 0.7, 3.5); resize(); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* =========================================================
   SELECTION / UI BINDING
   ========================================================= */
function currentSel(){ return OUTBREAKS.find(o=>o.id===state.selectedId); }

function selectOutbreak(id){
  state.selectedId = id;
  const o = currentSel();
  if(!o) return;
  flyTo(o);
  renderList();
  renderPanel();
  renderPopup();
}

function flyTo(o){
  if(!o) return;
  state.autoRotate = false; togRot.classList.remove('is-on');
  const start = [...state.rotation];
  const target = [-o.lon, -o.lat, 0];
  const d0 = ((target[0] - start[0] + 540) % 360) - 180;
  const t0 = performance.now();
  const dur = 900;
  (function step(t){
    const k = clamp((t - t0)/dur, 0, 1);
    const e = 1 - Math.pow(1-k, 3);
    state.rotation[0] = start[0] + d0*e;
    state.rotation[1] = start[1] + (target[1]-start[1])*e;
    projection.rotate(state.rotation);
    if(k<1) requestAnimationFrame(step);
  })(t0);
}

function matchesQuery(o, q){
  if(!q) return true;
  const hay = [o.name, o.country, o.region, o.pathogen, o.code, o.place]
    .filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(word => hay.includes(word));
}

function renderList(){
  const root = document.getElementById('list');
  const f = state.filter;
  const q = state.query;
  const items = OUTBREAKS.filter(o =>
    (f==='all' || o.sev===f) && matchesQuery(o, q)
  );
  document.getElementById('listCount').textContent = items.length;

  if(items.length === 0){
    root.innerHTML = `<div style="padding:20px 8px;text-align:center;color:var(--muted);font-size:12px;">No results for "${q}"</div>`;
    return;
  }

  root.innerHTML = items.map(o => {
    const ini = (o.country||'??').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `
    <div class="out-row ${o.id===state.selectedId?'is-selected':''}" data-id="${o.id}">
      <span class="sq bg-${sevClass(o.sev)}">${ini}</span>
      <div>
        <div class="nm">${diseaseName(o.name)}</div>
        <div class="lo">${o.country} · ${o.region}</div>
      </div>
      <div class="ct">${fmtNum(o.cases)}<small>${T('cases')}</small></div>
    </div>`;
  }).join('');
  root.querySelectorAll('.out-row').forEach(el=>{
    el.addEventListener('click', ()=> selectOutbreak(el.dataset.id));
    el.addEventListener('mouseenter', ()=>{ state.hoveredId = el.dataset.id; });
    el.addEventListener('mouseleave', ()=>{ state.hoveredId = null; });
  });
}

function sevClass(s){ return 's' + SEV[s].idx; }
function fmtNum(n){
  if(n>=1_000_000) return (n/1_000_000).toFixed(n>=10_000_000?0:1)+'M';
  if(n>=1000) return (n/1000).toFixed(n>=10_000?0:1)+'k';
  return n.toLocaleString();
}

function renderPanel(){
  const o = currentSel(); if(!o) return;
  const sev = SEV[o.sev];
  const grad = `linear-gradient(160deg, ${sev.light}, ${sev.color} 55%, ${sev.dark})`;

  document.getElementById('panEy').textContent = `${T('outbreak')} · ${o.code}`;
  document.getElementById('panName').innerHTML = breakName(diseaseName(o.name));
  document.getElementById('panLoc').textContent = `${o.place} · ${o.region}`;
  document.getElementById('panPin').style.background = sev.color;
  const ps = document.getElementById('panStatus');
  ps.style.background = grad;
  ps.style.boxShadow = `0 8px 20px -10px ${hexA(sev.color, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.14)`;
  ps.querySelector('.v').textContent = o.who;

  document.getElementById('mConf').textContent = fmtNum(o.cases);
  document.getElementById('mDeath').textContent = fmtNum(o.deaths);
  document.getElementById('mCfr').textContent = o.cfr.toFixed(o.cfr<1?2:1)+'%';
  document.getElementById('mRt').textContent  = o.rt.toFixed(2);
  // color the deaths metric value with severity
  document.getElementById('mDeath').style.color = sev.color;

  // severity index
  document.getElementById('sevIdxVal').textContent = `${o.sevIdx} / 100`;
  const pos = document.getElementById('sevPos');
  pos.innerHTML = '';
  const mk = document.createElement('span');
  mk.className = 'marker';
  mk.style.left = `calc(${o.sevIdx}% - 2px)`;
  pos.appendChild(mk);
  mk.querySelector ? null : null;
  // recolor marker dot
  const dot = document.createElement('style'); // simpler: set background on the dot via inline ::after — can't from JS, so set marker background gradient
  mk.style.background = sev.dark;

  // sparkline
  const w = 280, h = 64, pad = 4;
  const tr = o.trend;
  const mx = Math.max(...tr);
  const mn = Math.min(...tr);
  const sx = i => pad + (i/(tr.length-1)) * (w-pad*2);
  const sy = v => h-pad - ((v-mn)/Math.max(1,(mx-mn))) * (h-pad*2);
  let line = `M ${sx(0)} ${sy(tr[0])}`;
  let area = `M ${sx(0)} ${h-pad} L ${sx(0)} ${sy(tr[0])}`;
  for(let i=1;i<tr.length;i++){ line += ` L ${sx(i)} ${sy(tr[i])}`; area += ` L ${sx(i)} ${sy(tr[i])}`; }
  area += ` L ${sx(tr.length-1)} ${h-pad} Z`;
  document.getElementById('spark').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g${o.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sev.color}" stop-opacity="0.28"/>
          <stop offset="1" stop-color="${sev.color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${[0,1,2,3].map(i=>`<line x1="0" x2="${w}" y1="${pad+i*(h-pad*2)/3}" y2="${pad+i*(h-pad*2)/3}" stroke="rgba(0,0,0,0.05)" stroke-width="0.5"/>`).join('')}
      <path d="${area}" fill="url(#g${o.id})"/>
      <path d="${line}" fill="none" stroke="${sev.color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      ${tr.map((v,i)=>`<circle cx="${sx(i)}" cy="${sy(v)}" r="${i===tr.length-1?2.6:0}" fill="${sev.color}"/>`).join('')}
      ${tr.map((v,i)=>i===tr.length-1?`<circle cx="${sx(i)}" cy="${sy(v)}" r="5" fill="${sev.color}" opacity="0.18"/>`:'').join('')}
    </svg>`;
  document.getElementById('sparkBig').textContent = fmtNum(o.cases);
  const delta = tr[tr.length-1] - tr[tr.length-8] || 0;
  const trendEl = document.getElementById('sparkTrend');
  trendEl.innerHTML = `${delta>=0?'▲':'▼'} 7-day ${delta>=0?'+':''}${fmtNum(Math.abs(delta))}`;
  trendEl.style.background = sev.color;

  // AI card — accent border follows severity, dark bg stays from CSS
  const ai = document.getElementById('aiCard');
  ai.style.borderLeftColor = sev.color;
  document.getElementById('aiText').textContent = (LANG === 'ru' && o.blurb_ru) ? o.blurb_ru : o.blurb;

  // Risk block
  const riskEl = document.getElementById('riskBlock');
  if(riskEl){
    const risk = computeRisk(o);
    const riskColor = {low:'#3D8B5C', medium:'#C87B00', high:'#C92A2A'};
    const riskBg    = {low:'rgba(61,139,92,0.10)', medium:'rgba(200,123,0,0.10)', high:'rgba(201,42,42,0.10)'};
    const riskIcon  = {low:'🟢', medium:'🟡', high:'🔴'};
    const rows = [
      [T('riskTourist'),    risk.tourist],
      [T('riskResident'),   risk.resident],
      [T('riskHealthcare'), risk.healthcare],
    ];
    riskEl.innerHTML = `
      <div class="risk-title">${T('riskTitle')}</div>
      ${rows.map(([who, level])=>`
        <div class="risk-row">
          <span class="risk-who">${who}</span>
          <span class="risk-level" style="background:${riskBg[level]};color:${riskColor[level]}">${riskIcon[level]} ${T('risk'+level[0].toUpperCase()+level.slice(1))}</span>
        </div>`).join('')}
      <div class="risk-note">${T('riskNote')}</div>
    `;
  }

  // primary action button color
  document.querySelector('.btn.primary').style.background = grad;
  document.querySelector('.btn.primary').style.boxShadow = `0 8px 20px -10px ${hexA(sev.color,0.55)}, inset 0 1px 0 rgba(255,255,255,0.18)`;

  // events
  const ev = document.getElementById('events');
  if(!o.events || o.events.length===0){
    ev.innerHTML = `<div class="ev" style="color:var(--muted);"><span class="when">—</span><span class="what">${T('noEvents')}</span><span class="ct"></span></div>`;
  } else {
    ev.innerHTML = o.events.map(e=>`
      <div class="ev">
        <span class="when">${e.when}</span>
        <span class="what">${e.what}</span>
        <span class="ct" style="background:${e.ct?hexA(sev.color,0.13):'transparent'};color:${sev.color}">${e.ct||''}</span>
      </div>
    `).join('');
  }

  // crumb
  document.getElementById('crumbCountry').textContent  = o.country;
  document.getElementById('crumbOutbreak').textContent = o.name;
}

function breakName(name){
  if(name.length <= 14) return name;
  const sp = name.indexOf(' ', 5);
  if(sp<0) return name;
  return name.slice(0,sp) + '<br>' + name.slice(sp+1);
}

function renderPopup(){
  const o = currentSel(); if(!o) return;
  const sev = SEV[o.sev];
  const grad = `linear-gradient(160deg, ${sev.light}, ${sev.color} 55%, ${sev.dark})`;
  document.getElementById('popBar').style.background = sev.color;
  document.getElementById('popId').textContent = `${o.code} · WHO/${o.region}`;
  document.getElementById('popName').textContent = o.name;
  document.getElementById('popLoc').textContent  = o.place;
  document.getElementById('popPin').style.background = sev.color;
  document.getElementById('popSev').textContent  = sev.label;
  const tag = document.querySelector('.popup-tags .tag .dot');
  tag.className = 'dot fill-' + sevClass(o.sev);
  document.getElementById('popConf').textContent = fmtNum(o.cases);
  const pd = document.getElementById('popDeath');
  pd.textContent = fmtNum(o.deaths);
  pd.style.color = sev.color;
  const surv = document.getElementById('popSurvey');
  surv.style.background = grad;
  document.getElementById('popDelta').textContent = `+${fmtNum(o.new24)} new cases`;
  document.getElementById('popSub').textContent = `Last 24 hours · ${o.region} surveillance`;
}

/* chips */
document.getElementById('chips').addEventListener('click', e=>{
  const b = e.target.closest('.chip'); if(!b) return;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('is-active'));
  b.classList.add('is-active');
  state.filter = b.dataset.f;
  renderList();
});

/* search */
const _searchEl = document.getElementById('searchInput');
if(_searchEl){
  let _searchTimer;
  _searchEl.addEventListener('input', e=>{
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(()=>{
      state.query = e.target.value.trim();
      // Switch to globe view if in another view
      if(state.query && currentView !== 'globe') switchView('globe');
      renderList();
    }, 180);
  });
  // ⌘K / Ctrl+K focus shortcut
  document.addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && e.key==='k'){
      e.preventDefault(); _searchEl.focus(); _searchEl.select();
    }
    if(e.key==='Escape' && document.activeElement===_searchEl){
      _searchEl.value=''; state.query=''; renderList(); _searchEl.blur();
    }
  });
}

/* =========================================================
   LIVE DATA  (public/events.json — updated by GitHub Actions)
   ========================================================= */

// Severity mapping: API strings → OUTBREAKS sev keys
const SEV_MAP = { critical:'critical', high:'alert', medium:'warning', low:'monitoring' };

// Country name → {iso2, isoNum, lat, lng} fallback when API doesn't return coords
const COUNTRY_COORDS = {
  'democratic republic of the congo':{ iso:'CD', num:180, lat:-4.0,  lng:21.7  },
  'dr congo':                         { iso:'CD', num:180, lat:-4.0,  lng:21.7  },
  'nigeria':                          { iso:'NG', num:566, lat:9.1,   lng:8.7   },
  'ethiopia':                         { iso:'ET', num:231, lat:9.1,   lng:40.5  },
  'sudan':                            { iso:'SD', num:729, lat:15.5,  lng:32.5  },
  'south sudan':                      { iso:'SS', num:728, lat:7.9,   lng:29.7  },
  'kenya':                            { iso:'KE', num:404, lat:-1.3,  lng:36.8  },
  'uganda':                           { iso:'UG', num:800, lat:1.4,   lng:32.3  },
  'tanzania':                         { iso:'TZ', num:834, lat:-6.4,  lng:34.9  },
  'ghana':                            { iso:'GH', num:288, lat:7.9,   lng:-1.0  },
  'sierra leone':                     { iso:'SL', num:694, lat:8.5,   lng:-11.8 },
  'mali':                             { iso:'ML', num:466, lat:17.6,  lng:-4.0  },
  'niger':                            { iso:'NE', num:562, lat:17.6,  lng:8.1   },
  'chad':                             { iso:'TD', num:148, lat:15.5,  lng:18.7  },
  'cameroon':                         { iso:'CM', num:120, lat:3.9,   lng:11.5  },
  'somalia':                          { iso:'SO', num:706, lat:6.0,   lng:46.2  },
  'angola':                           { iso:'AO', num:24,  lat:-11.2, lng:17.9  },
  'mozambique':                       { iso:'MZ', num:508, lat:-18.7, lng:35.5  },
  'zimbabwe':                         { iso:'ZW', num:716, lat:-20.0, lng:30.0  },
  'zambia':                           { iso:'ZM', num:894, lat:-13.1, lng:27.8  },
  'guinea':                           { iso:'GN', num:324, lat:11.0,  lng:-10.9 },
  'liberia':                          { iso:'LR', num:430, lat:6.4,   lng:-9.4  },
  'brazil':                           { iso:'BR', num:76,  lat:-14.2, lng:-51.9 },
  'colombia':                         { iso:'CO', num:170, lat:4.6,   lng:-74.3 },
  'peru':                             { iso:'PE', num:604, lat:-9.2,  lng:-75.0 },
  'haiti':                            { iso:'HT', num:332, lat:19.0,  lng:-72.3 },
  'mexico':                           { iso:'MX', num:484, lat:23.6,  lng:-102.6},
  'united states':                    { iso:'US', num:840, lat:37.1,  lng:-95.7 },
  'pakistan':                         { iso:'PK', num:586, lat:30.4,  lng:69.3  },
  'afghanistan':                      { iso:'AF', num:4,   lat:33.9,  lng:67.7  },
  'iran':                             { iso:'IR', num:364, lat:32.4,  lng:53.7  },
  'iraq':                             { iso:'IQ', num:368, lat:33.2,  lng:43.7  },
  'yemen':                            { iso:'YE', num:887, lat:15.6,  lng:48.5  },
  'syria':                            { iso:'SY', num:760, lat:34.8,  lng:38.9  },
  'egypt':                            { iso:'EG', num:818, lat:26.8,  lng:30.8  },
  'india':                            { iso:'IN', num:356, lat:20.6,  lng:78.9  },
  'bangladesh':                       { iso:'BD', num:50,  lat:23.7,  lng:90.4  },
  'indonesia':                        { iso:'ID', num:360, lat:-0.8,  lng:113.9 },
  'myanmar':                          { iso:'MM', num:104, lat:16.9,  lng:96.1  },
  'thailand':                         { iso:'TH', num:764, lat:15.9,  lng:100.9 },
  'vietnam':                          { iso:'VN', num:704, lat:14.1,  lng:108.3 },
  'philippines':                      { iso:'PH', num:608, lat:12.9,  lng:121.8 },
  'china':                            { iso:'CN', num:156, lat:35.9,  lng:104.2 },
  'cambodia':                         { iso:'KH', num:116, lat:12.6,  lng:104.9 },
  'germany':                          { iso:'DE', num:276, lat:51.2,  lng:10.5  },
  'france':                           { iso:'FR', num:250, lat:46.2,  lng:2.2   },
  'italy':                            { iso:'IT', num:380, lat:41.9,  lng:12.6  },
  'ukraine':                          { iso:'UA', num:804, lat:48.4,  lng:31.2  },
  'russia':                           { iso:'RU', num:643, lat:61.5,  lng:105.3 },
  'kazakhstan':                       { iso:'KZ', num:398, lat:48.0,  lng:68.0  },
};

function resolveCoords(ev){
  // Already has coords → use them
  if(ev.lat && ev.lng) return { lat:ev.lat, lng:ev.lng, isoNum: ISO2_NUM[ev.iso?.toUpperCase()] || null };
  // Look up by country name
  const key = (ev.country||'').toLowerCase().trim();
  const c = COUNTRY_COORDS[key];
  if(c) return { lat:c.lat, lng:c.lng, isoNum:c.num };
  // Partial match
  for(const [name, data] of Object.entries(COUNTRY_COORDS)){
    if(key.includes(name) || name.includes(key)) return { lat:data.lat, lng:data.lng, isoNum:data.num };
  }
  return { lat:0, lng:0, isoNum:null };
}

// ISO numeric lookup table (alpha-2 → numeric) for the most common outbreak countries
const ISO2_NUM = {
  CD:180, NG:566, SD:729, US:840, TZ:834, BR:76, PK:586, AF:4,
  HT:332, IT:380, DE:276, AF:4, SO:706, ET:231, YE:887, IN:356,
  VN:704, SL:694, NE:562, MZ:508, KZ:398, UG:800, AO:24, MG:450,
  CM:120, CF:140, GN:324, LR:430, ML:466, SN:686, GH:288, CI:384,
  ZA:710, KE:404, RW:646, BD:50, MM:104, PH:608, ID:360, CN:156,
  JP:392, RU:643, FR:250, GB:826, ES:724, PT:620, GR:300, TR:792,
  IR:364, IQ:368, SY:760, LB:422, JO:400, SA:682, EG:818, MA:504,
  DZ:12, TN:788, LY:434, MR:478, BF:854, TD:148, SS:728, BI:108,
  ZM:894, ZW:716, TZ:834, UG:800, MW:454, BW:72, NA:516, SZ:748,
};

async function loadLiveData(){
  try {
    const base = window.EPISWOPE_BASE || './';
    const res = await fetch(base + 'public/events.json?_=' + Date.now());
    if(!res.ok) return;
    const json = await res.json();
    const events = json.events || [];
    if(!events.length) return;

    // Update "last data update" timestamp
    const updEl = document.getElementById('dataUpdated');
    if(updEl && json.meta?.updated_at){
      const d = new Date(json.meta.updated_at);
      const hh = String(d.getUTCHours()).padStart(2,'0');
      const mm = String(d.getUTCMinutes()).padStart(2,'0');
      const locale = LANG === 'ru' ? 'ru' : 'en';
      updEl.textContent = `${T('dataPrefix')} ${d.toLocaleDateString(locale,{month:'short',day:'numeric'})} ${hh}:${mm} UTC`;
    }

    // Convert API events to OUTBREAKS-compatible objects and inject them
    let injected = 0;
    for(const ev of events){
      if(!ev.disease || !ev.country) continue;
      const evId = `live-${ev.id}`;
      // Avoid duplicates
      if(OUTBREAKS.find(o => o.id === evId)) continue;

      const coords = resolveCoords(ev);

      OUTBREAKS.unshift({
        id: evId,
        code: `LIVE-${ev.source}-${new Date(ev.fetched_at||ev.date).toISOString().slice(0,10)}`,
        name: ev.disease,
        pathogen: ev.disease,
        country: ev.country,
        iso: coords.isoNum,
        region: ev.region || 'UNKNOWN',
        place: ev.country,
        lat: coords.lat,
        lon: coords.lng,
        sev: SEV_MAP[ev.severity] || 'monitoring',
        who: `${ev.source} · live feed`,
        cases: ev.cases || 0,
        deaths: ev.deaths || 0,
        cfr: ev.cases && ev.deaths ? ((ev.deaths/ev.cases)*100).toFixed(1) : 0,
        rt: 1.0,
        new24: 0,
        sevIdx: {critical:80,alert:60,warning:40,monitoring:20}[SEV_MAP[ev.severity]||'monitoring'],
        trend: [0,0,0,0,0,0,0, ev.cases||0],
        blurb: ev.summary || '',
        blurb_ru: ev.summary_ru || '',
        events: [],
        _live: true,
        _link: ev.link,
      });

      if(coords.isoNum) HIGHLIGHT_ISO.add(coords.isoNum);
      injected++;
    }

    if(injected > 0){
      console.log(`[EpiScope] Injected ${injected} live events`);
      renderList();
      renderPanel();
      renderPopup();
    }
  } catch(e){
    console.warn('[EpiScope] Live data unavailable:', e.message);
  }
}

/* =========================================================
   BOOT
   ========================================================= */
async function boot(){
  resize();
  try{
    const res = await fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json');
    const topo = await res.json();
    state.countries = topojson.feature(topo, topo.objects.countries).features;
  } catch(err){ console.error('world atlas failed', err); }
  renderList();
  renderPanel();
  renderPopup();
  requestAnimationFrame(frame);

  // Load live data after globe is visible
  loadLiveData();
  // Refresh every 30 minutes
  setInterval(loadLiveData, 30 * 60 * 1000);
}
boot();

setInterval(()=>{
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  const ss = String(d.getUTCSeconds()).padStart(2,'0');
  const sync = document.getElementById('lastSync'); if(sync) sync.textContent = `${hh}:${mm}:${ss} UTC`;
  const top = document.getElementById('topClock'); if(top) top.textContent = `${hh}:${mm} UTC`;
}, 1000);

/* =========================================================
   PATHOGENS DATA
   ========================================================= */
const PATHOGENS_DATA = [
  { id:'ebola', name:'Ebola Sudan-virus', short:'SUDV', family:'Filoviridae', genus:'Ebolavirus',
    type:'Virus · RNA, ssRNA(-)', transmission:'Direct contact · Body fluids', reservoir:'Fruit bats',
    incubation:'2–21 days', r0:1.83, cfr:50, vaccine:'Sabin-VLP (Phase 3)', vaccineStatus:'In trial',
    sev:'critical', activeCount:1, totalCases:142 },
  { id:'dengue', name:'Dengue serotype 2', short:'DENV-2', family:'Flaviviridae', genus:'Orthoflavivirus',
    type:'Virus · RNA, ssRNA(+)', transmission:'Vector · Aedes aegypti', reservoir:'Humans · NHP',
    incubation:'4–10 days', r0:2.4, cfr:0.05, vaccine:'Qdenga · CYD-TDV', vaccineStatus:'Licensed',
    sev:'alert', activeCount:1, totalCases:2420117 },
  { id:'cholera', name:'V. cholerae O1', short:'CHOL', family:'Vibrionaceae', genus:'Vibrio',
    type:'Bacterium · Gram-negative', transmission:'Faecal–oral · Water', reservoir:'Brackish water',
    incubation:'12h – 5d', r0:1.4, cfr:1.3, vaccine:'Dukoral · Euvichol', vaccineStatus:'Licensed',
    sev:'alert', activeCount:1, totalCases:45212 },
  { id:'h5n1', name:'H5N1 avian influenza', short:'AVI', family:'Orthomyxoviridae', genus:'Alphainfluenzavirus',
    type:'Virus · RNA, ssRNA(-)', transmission:'Zoonotic · Avian → human', reservoir:'Wild birds',
    incubation:'2–7 days', r0:0.4, cfr:52, vaccine:'Audenz · pre-pandemic', vaccineStatus:'Stockpiled',
    sev:'warning', activeCount:1, totalCases:6 },
  { id:'yfever', name:'Yellow Fever virus', short:'YFV', family:'Flaviviridae', genus:'Orthoflavivirus',
    type:'Virus · RNA, ssRNA(+)', transmission:'Vector · Aedes / Haemagogus', reservoir:'NHP',
    incubation:'3–6 days', r0:1.6, cfr:30, vaccine:'YF-17D · single dose', vaccineStatus:'Licensed',
    sev:'warning', activeCount:1, totalCases:8241 },
  { id:'mening', name:'N. meningitidis (NmC)', short:'NMC', family:'Neisseriaceae', genus:'Neisseria',
    type:'Bacterium · Gram-negative', transmission:'Respiratory droplets', reservoir:'Human nasopharynx',
    incubation:'1–10 days', r0:1.3, cfr:10, vaccine:'MenACWY-TT · MenAfriVac', vaccineStatus:'Licensed',
    sev:'alert', activeCount:1, totalCases:4812 },
  { id:'lassa', name:'Lassa virus', short:'LASV', family:'Arenaviridae', genus:'Mammarenavirus',
    type:'Virus · RNA, ambisense', transmission:'Rodent excreta · Nosocomial', reservoir:'Mastomys natalensis',
    incubation:'6–21 days', r0:1.1, cfr:15, vaccine:'INO-4500 · MV-LASV (Phase 1/2)', vaccineStatus:'In trial',
    sev:'warning', activeCount:1, totalCases:1204 },
  { id:'mpox', name:'Monkeypox virus (clade Ib)', short:'MPXV', family:'Poxviridae', genus:'Orthopoxvirus',
    type:'Virus · DNA, dsDNA', transmission:'Direct contact · Respiratory', reservoir:'Rodents',
    incubation:'5–21 days', r0:1.5, cfr:3.6, vaccine:'MVA-BN (Jynneos)', vaccineStatus:'Licensed',
    sev:'warning', activeCount:1, totalCases:15840 },
  { id:'malaria', name:'P. falciparum', short:'PF', family:'Plasmodiidae', genus:'Plasmodium',
    type:'Protozoan parasite', transmission:'Vector · Anopheles', reservoir:'Humans',
    incubation:'7–30 days', r0:5.0, cfr:0.22, vaccine:'RTS,S · R21/Matrix-M', vaccineStatus:'Licensed',
    sev:'alert', activeCount:1, totalCases:184220 },
  { id:'typhoid', name:'Typhoid XDR (S. Typhi)', short:'TYP', family:'Enterobacteriaceae', genus:'Salmonella',
    type:'Bacterium · Gram-negative', transmission:'Faecal–oral · Water', reservoir:'Humans',
    incubation:'8–14 days', r0:2.8, cfr:1.0, vaccine:'Typbar-TCV · Vi-TT', vaccineStatus:'Licensed',
    sev:'warning', activeCount:1, totalCases:12104 },
  { id:'rabies', name:'Rabies lyssavirus', short:'RBV', family:'Rhabdoviridae', genus:'Lyssavirus',
    type:'Virus · RNA, ssRNA(-)', transmission:'Animal bite · Saliva', reservoir:'Dogs · bats',
    incubation:'1–3 months', r0:0, cfr:99.9, vaccine:'PVRV · PCECV · PEP', vaccineStatus:'Licensed',
    sev:'monitoring', activeCount:1, totalCases:2104 },
  { id:'cchf', name:'Crimean–Congo HF', short:'CCHFV', family:'Nairoviridae', genus:'Orthonairovirus',
    type:'Virus · RNA, ssRNA(-)', transmission:'Tick bite · Viremic livestock', reservoir:'Hyalomma ticks',
    incubation:'1–13 days', r0:1.0, cfr:30, vaccine:'CCHF-AdV (Phase 1)', vaccineStatus:'In trial',
    sev:'monitoring', activeCount:1, totalCases:312 },
  { id:'measles', name:'Measles morbillivirus', short:'MEV', family:'Paramyxoviridae', genus:'Morbillivirus',
    type:'Virus · RNA, ssRNA(-)', transmission:'Respiratory · Aerosol', reservoir:'Humans',
    incubation:'10–14 days', r0:15, cfr:0.1, vaccine:'MR · MMR', vaccineStatus:'Licensed',
    sev:'monitoring', activeCount:0, totalCases:0 },
  { id:'polio', name:'Poliovirus (cVDPV2)', short:'POL', family:'Picornaviridae', genus:'Enterovirus',
    type:'Virus · RNA, ssRNA(+)', transmission:'Faecal–oral', reservoir:'Humans',
    incubation:'7–21 days', r0:5.0, cfr:5.0, vaccine:'IPV · nOPV2 · OPV', vaccineStatus:'Licensed',
    sev:'monitoring', activeCount:0, totalCases:0 },
];

/* =========================================================
   REPORTS DATA
   ========================================================= */
const REPORTS_DATA = [
  { id:'r-2026-w19', no:'WHO-WER-2026-19', title:'Weekly Epidemiological Record — Week 19',
    type:'Weekly bulletin', date:'2026-05-10', author:'WHO Geneva', region:'Global', sev:'alert', pages:14,
    summary:'Cumulative dengue notifications in the Americas surpass 4.1 million for 2026 — DENV-2 dominance confirmed in 14 of 18 reporting countries. Sudan-virus Ebola cluster in Uganda expands to 142 confirmed cases.',
    tags:['Dengue','Ebola','Cholera','Yellow Fever'] },
  { id:'r-2026-uga-sit', no:'EPI-SR-UGA-2026-007', title:'Sudan-virus Ebola, Uganda — Situation Report #7',
    type:'Situation report', date:'2026-05-11', author:'WHO/AFRO · MoH Uganda', region:'AFRO', sev:'critical', pages:22,
    summary:'Outbreak active 41 days. Cases expanding into Kassanda and Kyegegwa. CFR at 26.8%. Genomic confirmation Sudan-virus clade C. WHO mission deployed; PHEIC determination pending IHR committee on 14 May.',
    tags:['Ebola','Uganda','PHEIC','Filoviridae'] },
  { id:'r-2026-pheic', no:'WHO-RA-2026-014', title:'Risk Assessment — Sudan-virus Ebola, Uganda',
    type:'Risk assessment', date:'2026-05-09', author:'WHO IHR Secretariat', region:'Global', sev:'critical', pages:9,
    summary:'Probability of regional spread assessed HIGH; international spread MODERATE. Cross-border surveillance heightened in Kenya, Tanzania, Rwanda, DRC and South Sudan.',
    tags:['Ebola','IHR','PHEIC','AFRO'] },
  { id:'r-2026-dengue-am', no:'PAHO-DENG-2026-04', title:'Dengue Americas — Monthly Bulletin (April)',
    type:'Weekly bulletin', date:'2026-05-05', author:'PAHO/WHO', region:'AMRO', sev:'alert', pages:18,
    summary:'4.12 million cumulative cases in the Americas through epidemiological week 18 — a 173% increase over the 5-year average. Brazil accounts for 58% of the regional caseload.',
    tags:['Dengue','DENV-2','AMRO','Aedes'] },
  { id:'r-2026-mpox-ic', no:'WHO-MPX-IC-2026-03', title:'Mpox IHR Emergency Committee — Third Meeting',
    type:'Briefing', date:'2026-05-08', author:'WHO Director-General', region:'AFRO', sev:'warning', pages:6,
    summary:'PHEIC determination maintained. Clade Ib transmission established in 6 countries; vaccination coverage in priority areas remains under 30%. Resource gap of USD 218M flagged.',
    tags:['Mpox','PHEIC','MVA-BN'] },
  { id:'r-2026-cholera', no:'WHO-CHOL-2026-08', title:'Cholera — Global Snapshot, April',
    type:'Situation report', date:'2026-05-06', author:'WHO Cholera Team', region:'Global', sev:'alert', pages:11,
    summary:'25 countries reporting active cholera transmission. OCV stockpile depleted to 1.4M doses; ICG operating on rationing protocol. Sudan, DRC, Ethiopia and Yemen account for 71% of suspected cases.',
    tags:['Cholera','OCV','Sudan','Yemen'] },
  { id:'r-2026-h5n1', no:'WHO-FLU-RA-2026-02', title:'Avian Influenza A(H5N1) — Risk Assessment',
    type:'Risk assessment', date:'2026-05-04', author:'WHO Global Influenza Programme', region:'Global', sev:'warning', pages:13,
    summary:'Risk to general population assessed LOW. Risk to occupationally exposed groups MODERATE. Pre-pandemic vaccine stockpile holds 39M doses; manufacturing capacity scenarios reviewed.',
    tags:['H5N1','Pandemic Preparedness','Influenza'] },
  { id:'r-2026-mening', no:'AFRO-MEN-2026-W19', title:'Meningitis Belt — Week 19',
    type:'Weekly bulletin', date:'2026-05-10', author:'WHO/AFRO', region:'AFRO', sev:'alert', pages:7,
    summary:'Niger, Burkina Faso, Mali and northern Nigeria above attack-rate alert threshold. ICG vaccine request approved for Niger — 1.8M doses MenACWY-TT.',
    tags:['Meningitis','NmC','AFRO','ICG'] },
  { id:'r-2026-yf', no:'WHO-YF-2026-01', title:'Yellow Fever EYE Strategy — Mid-Term Review',
    type:'Briefing', date:'2026-04-30', author:'WHO/UNICEF/Gavi', region:'Global', sev:'warning', pages:42,
    summary:'EYE strategy mid-term review concludes the 2017–2026 strategy delivered routine coverage gains but stockpile resilience remains the binding constraint. Recommendations for 2027–2032 cycle.',
    tags:['Yellow Fever','EYE','Vaccination','Gavi'] },
  { id:'r-2026-amr', no:'WHO-AMR-2026-01', title:'AMR Bacterial Priority Pathogens List — 2026 Update',
    type:'Briefing', date:'2026-04-28', author:'WHO AMR Division', region:'Global', sev:'alert', pages:34,
    summary:'Carbapenem-resistant Enterobacterales remain Critical. Salmonella Typhi XDR maintained as Critical. New WHO priority list adds C. auris Critical and gonorrhoea High.',
    tags:['AMR','Priority Pathogens','XDR'] },
  { id:'r-2026-malaria', no:'WHO-MAL-2026-Q1', title:'Malaria Quarterly — Q1 2026',
    type:'Weekly bulletin', date:'2026-04-22', author:'WHO Global Malaria Programme', region:'Global', sev:'alert', pages:24,
    summary:'R21/Matrix-M deployment now in 21 countries · 27M doses administered Q1. Mozambique post-cyclone surge under reactive control.',
    tags:['Malaria','R21','RTS,S','Mozambique'] },
  { id:'r-2026-cchf', no:'EURO-CCHF-2026-01', title:'CCHF in Europe and Central Asia — Annual',
    type:'Situation report', date:'2026-04-20', author:'WHO/EURO', region:'EURO', sev:'monitoring', pages:16,
    summary:'CCHFV expanding range — autochthonous cases now in 12 European and Central Asian countries. Hyalomma marginatum spread linked to climate variables.',
    tags:['CCHF','Hyalomma','One Health','EURO'] },
];

/* =========================================================
   VIEW SWITCHING
   ========================================================= */
const APP = document.getElementById('app');
const VIEW_NAMES = ['globe','heatmap','pathogens','reports'];
let currentView = 'globe';

function switchView(name){
  if(!VIEW_NAMES.includes(name)) return;
  currentView = name;

  // Update app class (handles grid layout)
  APP.className = `app v-${name}`;

  // Show/hide view containers
  VIEW_NAMES.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if(el) el.classList.toggle('is-active', v === name);
  });

  // Update tab buttons
  document.querySelectorAll('.top-tab').forEach((tab, i) => {
    tab.classList.toggle('is-active', i === VIEW_NAMES.indexOf(name));
  });

  // Switch sidebar sections
  const sg = document.querySelector('.sidebar-globe');
  const sp = document.querySelector('.sidebar-pathogens');
  const sr = document.querySelector('.sidebar-reports');
  if(sg) sg.classList.toggle('hidden', name === 'pathogens' || name === 'reports');
  if(sp) sp.classList.toggle('hidden', name !== 'pathogens');
  if(sr) sr.classList.toggle('hidden', name !== 'reports');

  // Initialize view content
  if(name === 'heatmap')    renderHeatmap();
  if(name === 'pathogens')  renderPathogens();
  if(name === 'reports')    renderReports();
}

// Wire up top tabs
document.querySelectorAll('.top-tab').forEach((tab, i) => {
  tab.addEventListener('click', () => switchView(VIEW_NAMES[i]));
});

/* =========================================================
   HEATMAP VIEW
   ========================================================= */
let heatmapInited = false;

function renderHeatmap(){
  if(heatmapInited) return;
  if(!state.countries.length){ setTimeout(renderHeatmap, 400); return; }
  heatmapInited = true;

  const svgEl = document.getElementById('heatmapSvg');
  const wrap  = svgEl.parentElement;
  const W = wrap.clientWidth || 800;
  const H = wrap.clientHeight || 500;

  const proj = d3.geoNaturalEarth1()
    .scale(W / 6.3)
    .translate([W / 2, H / 2]);
  const pathGen = d3.geoPath(proj);

  const isoMap = {};
  OUTBREAKS.forEach(o => { isoMap[o.iso] = o; });

  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);

  // Ocean
  svg.append('rect').attr('width', W).attr('height', H)
     .attr('fill','rgba(160,190,220,0.10)');

  // Graticule
  svg.append('path')
     .datum(d3.geoGraticule()())
     .attr('d', pathGen)
     .attr('fill','none')
     .attr('stroke','rgba(56,48,34,0.07)')
     .attr('stroke-width', 0.4);

  const tooltip = document.getElementById('hmapTooltip');

  svg.selectAll('.hmap-country')
    .data(state.countries)
    .join('path')
    .attr('class','hmap-country')
    .attr('d', pathGen)
    .attr('fill', d => {
      const o = isoMap[+d.id];
      return o ? hexA(SEV[o.sev].color, 0.72) : 'rgba(150,140,118,0.28)';
    })
    .attr('stroke', d => {
      const o = isoMap[+d.id];
      return o ? hexA(SEV[o.sev].dark, 0.75) : 'rgba(40,30,18,0.18)';
    })
    .attr('stroke-width', d => isoMap[+d.id] ? 0.8 : 0.3)
    .on('mousemove', (event, d) => {
      const o = isoMap[+d.id];
      if(!o){ tooltip.classList.remove('is-on'); return; }
      tooltip.classList.add('is-on');
      tooltip.style.left = (event.clientX + 14) + 'px';
      tooltip.style.top  = (event.clientY - 8)  + 'px';
      tooltip.innerHTML = `
        <div class="t-name">${o.name}</div>
        <div class="t-loc">${o.place}</div>
        <div class="t-row">
          <div><div class="t-k">${T('confirmed')}</div><div class="t-v">${fmtNum(o.cases)}</div></div>
          <div><div class="t-k">${T('deaths')}</div><div class="t-v" style="color:${SEV[o.sev].color}">${fmtNum(o.deaths)}</div></div>
          <div><div class="t-k">${T('severity')}</div><div class="t-v" style="color:${SEV[o.sev].color};font-size:13px">${SEV[o.sev].label}</div></div>
        </div>`;
    })
    .on('mouseleave', () => tooltip.classList.remove('is-on'))
    .on('click', (event, d) => {
      const o = isoMap[+d.id];
      if(o){ switchView('globe'); selectOutbreak(o.id); }
    });
}

/* =========================================================
   PATHOGENS VIEW
   ========================================================= */
let pathFilter = { type:'all', show:'all' };

function renderPathogens(){
  const grid = document.getElementById('pathGrid');
  if(!grid) return;

  const items = PATHOGENS_DATA.filter(p => {
    if(pathFilter.show === 'active' && p.activeCount === 0) return false;
    if(pathFilter.type !== 'all'){
      const t = p.type.toLowerCase();
      if(pathFilter.type === 'virus'    && !t.includes('virus'))    return false;
      if(pathFilter.type === 'bacteria' && !t.includes('bacterium'))return false;
      if(pathFilter.type === 'parasite' && !t.includes('protozoan'))return false;
    }
    return true;
  });

  const countEl = document.getElementById('pathResultCount');
  const sideEl  = document.getElementById('pathCount');
  if(countEl) countEl.textContent = items.length;
  if(sideEl)  sideEl.textContent  = items.length;

  grid.innerHTML = items.map(p => {
    const sev = SEV[p.sev];
    const hasActive = p.activeCount > 0;
    const vClass = p.vaccineStatus.includes('Licensed') ? 'vok' :
                   p.vaccineStatus.includes('trial') || p.vaccineStatus.includes('Trial') ? 'vtrial' : 'vno';
    const vLabel = p.vaccineStatus.includes('Licensed') ? T('vaccLicensed') :
                   p.vaccineStatus.includes('trial') || p.vaccineStatus.includes('Trial') ? T('vaccTrial') : T('vaccNone');
    return `
    <div class="path-card ${hasActive?'':'inactive'}" data-pid="${p.id}">
      <div class="path-card-top">
        <span class="path-sev-dot" style="background:${sev.color}"></span>
        <span class="path-name">${p.name}</span>
        <span class="path-short">${p.short}</span>
      </div>
      <div class="path-family">${p.family} · ${p.genus}</div>
      <div class="path-stats">
        <div class="path-stat"><div class="k">R₀</div><div class="v">${p.r0===0?'—':p.r0.toFixed(1)}</div></div>
        <div class="path-stat"><div class="k">CFR</div><div class="v">${p.cfr}%</div></div>
        <div class="path-stat"><div class="k">${T('incubation')}</div><div class="v sm">${p.incubation}</div></div>
        <div class="path-stat"><div class="k">${T('transmission')}</div><div class="v sm">${p.transmission.split('·')[0].trim()}</div></div>
      </div>
      <div class="path-footer">
        ${hasActive ? `<span class="path-badge active">● ${p.activeCount} ${T('active')}</span>` : ''}
        <span class="path-badge ${vClass}">${vLabel}</span>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.path-card').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.dataset.pid;
      const o = OUTBREAKS.find(o => o.id.startsWith(pid) || o.id.includes(pid));
      if(o){ switchView('globe'); selectOutbreak(o.id); }
    });
  });
}

document.getElementById('pathTypeChips')?.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if(!b) return;
  document.querySelectorAll('#pathTypeChips .chip').forEach(c => c.classList.remove('is-active'));
  b.classList.add('is-active');
  pathFilter.type = b.dataset.pt;
  renderPathogens();
});
document.getElementById('pathShowChips')?.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if(!b) return;
  document.querySelectorAll('#pathShowChips .chip').forEach(c => c.classList.remove('is-active'));
  b.classList.add('is-active');
  pathFilter.show = b.dataset.ps;
  renderPathogens();
});

/* =========================================================
   REPORTS VIEW
   ========================================================= */
let repFilter = { type:'all', region:'all' };

function renderReports(){
  const list = document.getElementById('repList');
  if(!list) return;

  const items = REPORTS_DATA.filter(r => {
    if(repFilter.type   !== 'all' && r.type   !== repFilter.type)   return false;
    if(repFilter.region !== 'all' && r.region !== repFilter.region) return false;
    return true;
  });

  const countEl = document.getElementById('repResultCount');
  const sideEl  = document.getElementById('repCount');
  if(countEl) countEl.textContent = items.length;
  if(sideEl)  sideEl.textContent  = items.length;

  list.innerHTML = items.map(r => {
    const sev = SEV[r.sev];
    return `
    <div class="rep-card" data-rid="${r.id}">
      <span class="rep-type">${r.type}</span>
      <div class="rep-body">
        <div class="rep-no">${r.no}</div>
        <div class="rep-title">${r.title}</div>
        <div class="rep-meta">${r.author} · ${r.region}</div>
        <div class="rep-summary">${r.summary}</div>
        <div class="rep-tags">${r.tags.map(t=>`<span class="rep-tag">${t}</span>`).join('')}</div>
      </div>
      <div class="rep-right">
        <span class="rep-sev-dot" style="background:${sev.color}"></span>
        <span class="rep-date">${r.date}</span>
        <span class="rep-pages">${r.pages}p</span>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('repTypeChips')?.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if(!b) return;
  document.querySelectorAll('#repTypeChips .chip').forEach(c => c.classList.remove('is-active'));
  b.classList.add('is-active');
  repFilter.type = b.dataset.rt;
  renderReports();
});
document.getElementById('repRegionChips')?.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if(!b) return;
  document.querySelectorAll('#repRegionChips .chip').forEach(c => c.classList.remove('is-active'));
  b.classList.add('is-active');
  repFilter.region = b.dataset.rr;
  renderReports();
});
