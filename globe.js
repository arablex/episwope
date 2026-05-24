/* =========================================================
   Vigilo v2 — refined globe + 2026 UI bindings
   ========================================================= */

/* ── Analytics helper — fires to BOTH Plausible and Yandex.Metrika ───────── */
function track(event, props){
  try{ if(typeof window.plausible === 'function') window.plausible(event, props ? { props } : undefined); }catch(e){}
  try{ if(typeof window.ym === 'function') window.ym(109240834, 'reachGoal', event, props || undefined); }catch(e){}
}
window.track = track;

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
    vaccLicensed:'Vaccine licensed',
    vaccTrial:'In trial',
    vaccNone:'No vaccine',
    active:'active',
    pages:'pages',
    noEvents:'No events logged in the last 24h.',
    liveInjected:'Injected {n} live events',
    liveUnavailable:'Live data unavailable:',
    travelAdvisory: 'Travel Advisory',
    watchBtn: 'Watch region',
    watchedBtn: 'Watching',
    otherThreats: 'Other threats in',
    trendLabel: 'Trend (14d)',
    riskTitle:'How dangerous is this for you?',
    riskTourist:'Traveler to region',
    riskResident:'Local resident',
    riskHealthcare:'Healthcare worker',
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
    vaccLicensed:'Вакцина одобрена',
    vaccTrial:'В испытании',
    vaccNone:'Вакцины нет',
    active:'активно',
    pages:'стр.',
    noEvents:'Событий за последние 24ч не зафиксировано.',
    liveInjected:'Загружено {n} событий',
    liveUnavailable:'Данные недоступны:',
    travelAdvisory: 'Рекомендации для путешественников',
    watchBtn: 'Следить за регионом',
    watchedBtn: 'Слежу',
    otherThreats: 'Другие угрозы в',
    trendLabel: 'Динамика (14д)',
    riskTitle:'Насколько это опасно для вас?',
    riskTourist:'Турист в регионе',
    riskResident:'Местный житель',
    riskHealthcare:'Медработник',
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
function diseaseName(o_or_name){
  if(typeof o_or_name === 'object'){
    if(LANG === 'ru' && o_or_name.name_ru) return o_or_name.name_ru;
    return o_or_name.name;
  }
  return LANG === 'ru' ? (DISEASE_RU[o_or_name] || o_or_name) : o_or_name;
}

// Localised short label for a risk/news event (so the prominent title isn't a
// giant raw English article headline, and reads in RU). The full headline is
// kept separately as small detail text via fullHeadline().
const RISK_DOMAIN_LABEL = {
  conflict:       { en:'Armed conflict',       ru:'Вооружённый конфликт' },
  civil_unrest:   { en:'Civil unrest',         ru:'Гражданские беспорядки' },
  transport:      { en:'Transport disruption', ru:'Сбой транспорта' },
  border:         { en:'Border / entry',       ru:'Границы и въезд' },
  infrastructure: { en:'Infrastructure',       ru:'Инфраструктура' },
  climate:        { en:'Natural disaster',     ru:'Стихийное бедствие' },
  food:           { en:'Food security',        ru:'Продовольствие' },
};
function shortTitle(o){
  // Risk/news event → localised domain label + place ("Civil unrest · Gaza").
  if(o && o._risk){
    const dl = RISK_DOMAIN_LABEL[o._riskCat] || { en:'Risk event', ru:'Событие риска' };
    const lbl = LANG === 'ru' ? dl.ru : dl.en;
    const place = countryName(o.place || o.country) || o.place || o.country || '';
    return place ? `${lbl} · ${place}` : lbl;
  }
  // Everything else (epidemics etc.) already has a short name.
  return diseaseName(o);
}
function fullHeadline(o){
  // The raw article headline — shown small as detail. English (source text);
  // we don't machine-translate article bodies.
  return (o && (o.name || o.blurb)) || '';
}

/* ── Country & region translations ───────────────────────── */
const COUNTRY_RU = {
  'Uganda':'Уганда','Brazil':'Бразилия','Sudan':'Судан','South Sudan':'Южный Судан',
  'Vietnam':'Вьетнам','Nigeria':'Нигерия','Niger':'Нигер','Sierra Leone':'Сьерра-Леоне',
  'DR Congo':'ДР Конго','Democratic Republic of the Congo':'ДР Конго',
  'Mozambique':'Мозамбик','Pakistan':'Пакистан','India':'Индия','Kazakhstan':'Казахстан',
  'Tanzania':'Танзания','Haiti':'Гаити','Afghanistan':'Афганистан','Germany':'Германия',
  'Italy':'Италия','United States':'США','Russia':'Россия','China':'Китай',
  'France':'Франция','Kenya':'Кения','Ethiopia':'Эфиопия','Ghana':'Гана','Somalia':'Сомали',
  'Yemen':'Йемен','Syria':'Сирия','Iraq':'Ирак','Iran':'Иран','Egypt':'Египет',
  'Mali':'Мали','Chad':'Чад','Cameroon':'Камерун','Angola':'Ангола','Zambia':'Замбия',
  'Zimbabwe':'Зимбабве','Colombia':'Колумбия','Peru':'Перу','Bolivia':'Боливия',
  'Argentina':'Аргентина','Mexico':'Мексика','Bangladesh':'Бангладеш',
  'Indonesia':'Индонезия','Myanmar':'Мьянма','Thailand':'Таиланд','Cambodia':'Камбоджа',
  'Philippines':'Филиппины','Papua New Guinea':'Папуа — Новая Гвинея',
  'Ukraine':'Украина','Turkey':'Турция','Guinea':'Гвинея','Liberia':'Либерия',
  'Burkina Faso':'Буркина-Фасо','Senegal':'Сенегал','Morocco':'Марокко',
  'Libya':'Ливия','Tunisia':'Тунис','Algeria':'Алжир',
  'Malaysia':'Малайзия','Singapore':'Сингапур','Japan':'Япония','Taiwan':'Тайвань',
  'South Korea':'Южная Корея','Saudi Arabia':'Саудовская Аравия','South Africa':'ЮАР',
  'United Kingdom':'Великобритания','Georgia':'Грузия','Lebanon':'Ливан','Jordan':'Иордания',
  'United Arab Emirates':'ОАЭ','Qatar':'Катар','Oman':'Оман','Kuwait':'Кувейт',
  'Sri Lanka':'Шри-Ланка','Nepal':'Непал','Laos':'Лаос','Mongolia':'Монголия',
  'Rwanda':'Руанда','Burundi':'Бурунди','Malawi':'Малави','Madagascar':'Мадагаскар',
  'Côte d’Ivoire':'Кот-д’Ивуар','Ivory Coast':'Кот-д’Ивуар','Benin':'Бенин','Togo':'Того',
  'Gabon':'Габон','Republic of the Congo':'Республика Конго','Eritrea':'Эритрея',
  'Spain':'Испания','Portugal':'Португалия','Poland':'Польша','Romania':'Румыния',
  'Greece':'Греция','Netherlands':'Нидерланды','Belgium':'Бельгия','Sweden':'Швеция',
  'Australia':'Австралия','New Zealand':'Новая Зеландия','Canada':'Канада',
  'Venezuela':'Венесуэла','Ecuador':'Эквадор','Chile':'Чили','Paraguay':'Парагвай',
};

/* ── Full country master list (198 countries + territories) ── */
const ALL_COUNTRIES = [
  { en:'Afghanistan',                  ru:'Афганистан',            iso2:'AF', num:4,   lat:33.94, lng:67.71 },
  { en:'Albania',                      ru:'Албания',               iso2:'AL', num:8,   lat:41.15, lng:20.17 },
  { en:'Algeria',                      ru:'Алжир',                 iso2:'DZ', num:12,  lat:28.03, lng:1.66 },
  { en:'Andorra',                      ru:'Андорра',               iso2:'AD', num:20,  lat:42.51, lng:1.52 },
  { en:'Angola',                       ru:'Ангола',                iso2:'AO', num:24,  lat:-11.20, lng:17.87 },
  { en:'Antigua and Barbuda',          ru:'Антигуа и Барбуда',     iso2:'AG', num:28,  lat:17.06, lng:-61.80 },
  { en:'Argentina',                    ru:'Аргентина',             iso2:'AR', num:32,  lat:-38.42, lng:-63.62 },
  { en:'Armenia',                      ru:'Армения',               iso2:'AM', num:51,  lat:40.07, lng:45.04 },
  { en:'Australia',                    ru:'Австралия',             iso2:'AU', num:36,  lat:-25.27, lng:133.78 },
  { en:'Austria',                      ru:'Австрия',               iso2:'AT', num:40,  lat:47.52, lng:14.55 },
  { en:'Azerbaijan',                   ru:'Азербайджан',           iso2:'AZ', num:31,  lat:40.14, lng:47.58 },
  { en:'Bahamas',                      ru:'Багамы',                iso2:'BS', num:44,  lat:25.03, lng:-77.40 },
  { en:'Bahrain',                      ru:'Бахрейн',               iso2:'BH', num:48,  lat:25.93, lng:50.64 },
  { en:'Bangladesh',                   ru:'Бангладеш',             iso2:'BD', num:50,  lat:23.68, lng:90.36 },
  { en:'Barbados',                     ru:'Барбадос',              iso2:'BB', num:52,  lat:13.19, lng:-59.54 },
  { en:'Belarus',                      ru:'Беларусь',              iso2:'BY', num:112, lat:53.71, lng:27.95 },
  { en:'Belgium',                      ru:'Бельгия',               iso2:'BE', num:56,  lat:50.50, lng:4.47 },
  { en:'Belize',                       ru:'Белиз',                 iso2:'BZ', num:84,  lat:17.19, lng:-88.50 },
  { en:'Benin',                        ru:'Бенин',                 iso2:'BJ', num:204, lat:9.31, lng:2.32 },
  { en:'Bhutan',                       ru:'Бутан',                 iso2:'BT', num:64,  lat:27.51, lng:90.43 },
  { en:'Bolivia',                      ru:'Боливия',               iso2:'BO', num:68,  lat:-16.29, lng:-63.59 },
  { en:'Bosnia and Herzegovina',       ru:'Босния и Герцеговина',  iso2:'BA', num:70,  lat:43.92, lng:17.68 },
  { en:'Botswana',                     ru:'Ботсвана',              iso2:'BW', num:72,  lat:-22.33, lng:24.68 },
  { en:'Brazil',                       ru:'Бразилия',              iso2:'BR', num:76,  lat:-14.24, lng:-51.93 },
  { en:'Brunei',                       ru:'Бруней',                iso2:'BN', num:96,  lat:4.54, lng:114.73 },
  { en:'Bulgaria',                     ru:'Болгария',              iso2:'BG', num:100, lat:42.73, lng:25.49 },
  { en:'Burkina Faso',                 ru:'Буркина-Фасо',          iso2:'BF', num:854, lat:12.24, lng:-1.56 },
  { en:'Burundi',                      ru:'Бурунди',               iso2:'BI', num:108, lat:-3.37, lng:29.92 },
  { en:'Cambodia',                     ru:'Камбоджа',              iso2:'KH', num:116, lat:12.57, lng:104.99 },
  { en:'Cameroon',                     ru:'Камерун',               iso2:'CM', num:120, lat:7.37, lng:12.35 },
  { en:'Canada',                       ru:'Канада',                iso2:'CA', num:124, lat:56.13, lng:-106.35 },
  { en:'Cape Verde',                   ru:'Кабо-Верде',            iso2:'CV', num:132, lat:16.54, lng:-23.04 },
  { en:'Central African Republic',     ru:'ЦАР',                   iso2:'CF', num:140, lat:6.61, lng:20.94 },
  { en:'Chad',                         ru:'Чад',                   iso2:'TD', num:148, lat:15.45, lng:18.73 },
  { en:'Chile',                        ru:'Чили',                  iso2:'CL', num:152, lat:-35.68, lng:-71.54 },
  { en:'China',                        ru:'Китай',                 iso2:'CN', num:156, lat:35.86, lng:104.20 },
  { en:'Colombia',                     ru:'Колумбия',              iso2:'CO', num:170, lat:4.57, lng:-74.30 },
  { en:'Comoros',                      ru:'Коморы',                iso2:'KM', num:174, lat:-11.65, lng:43.33 },
  { en:'Congo',                        ru:'Республика Конго',      iso2:'CG', num:178, lat:-0.23, lng:15.83 },
  { en:'Costa Rica',                   ru:'Коста-Рика',            iso2:'CR', num:188, lat:9.75, lng:-83.75 },
  { en:'Croatia',                      ru:'Хорватия',              iso2:'HR', num:191, lat:45.10, lng:15.20 },
  { en:'Cuba',                         ru:'Куба',                  iso2:'CU', num:192, lat:21.52, lng:-77.78 },
  { en:'Cyprus',                       ru:'Кипр',                  iso2:'CY', num:196, lat:35.13, lng:33.43 },
  { en:'Czech Republic',               ru:'Чехия',                 iso2:'CZ', num:203, lat:49.82, lng:15.47 },
  { en:'Democratic Republic of Congo', ru:'ДР Конго',              iso2:'CD', num:180, lat:-4.04, lng:21.76 },
  { en:'Denmark',                      ru:'Дания',                 iso2:'DK', num:208, lat:56.26, lng:9.50 },
  { en:'Djibouti',                     ru:'Джибути',               iso2:'DJ', num:262, lat:11.83, lng:42.59 },
  { en:'Dominica',                     ru:'Доминика',              iso2:'DM', num:212, lat:15.41, lng:-61.37 },
  { en:'Dominican Republic',           ru:'Доминиканская Республика', iso2:'DO', num:214, lat:18.74, lng:-70.16 },
  { en:'East Timor',                   ru:'Восточный Тимор',       iso2:'TL', num:626, lat:-8.87, lng:125.73 },
  { en:'Ecuador',                      ru:'Эквадор',               iso2:'EC', num:218, lat:-1.83, lng:-78.18 },
  { en:'Egypt',                        ru:'Египет',                iso2:'EG', num:818, lat:26.82, lng:30.80 },
  { en:'El Salvador',                  ru:'Сальвадор',             iso2:'SV', num:222, lat:13.79, lng:-88.90 },
  { en:'Equatorial Guinea',            ru:'Экваториальная Гвинея', iso2:'GQ', num:226, lat:1.65, lng:10.27 },
  { en:'Eritrea',                      ru:'Эритрея',               iso2:'ER', num:232, lat:15.18, lng:39.78 },
  { en:'Estonia',                      ru:'Эстония',               iso2:'EE', num:233, lat:58.60, lng:25.01 },
  { en:'Eswatini',                     ru:'Эсватини',              iso2:'SZ', num:748, lat:-26.52, lng:31.47 },
  { en:'Ethiopia',                     ru:'Эфиопия',               iso2:'ET', num:231, lat:9.15, lng:40.49 },
  { en:'Fiji',                         ru:'Фиджи',                 iso2:'FJ', num:242, lat:-16.58, lng:179.41 },
  { en:'Finland',                      ru:'Финляндия',             iso2:'FI', num:246, lat:61.92, lng:25.75 },
  { en:'France',                       ru:'Франция',               iso2:'FR', num:250, lat:46.23, lng:2.21 },
  { en:'Gabon',                        ru:'Габон',                 iso2:'GA', num:266, lat:-0.80, lng:11.61 },
  { en:'Gambia',                       ru:'Гамбия',                iso2:'GM', num:270, lat:13.44, lng:-15.31 },
  { en:'Georgia',                      ru:'Грузия',                iso2:'GE', num:268, lat:42.32, lng:43.36 },
  { en:'Germany',                      ru:'Германия',              iso2:'DE', num:276, lat:51.17, lng:10.45 },
  { en:'Ghana',                        ru:'Гана',                  iso2:'GH', num:288, lat:7.95, lng:-1.02 },
  { en:'Greece',                       ru:'Греция',                iso2:'GR', num:300, lat:39.07, lng:21.82 },
  { en:'Grenada',                      ru:'Гренада',               iso2:'GD', num:308, lat:12.26, lng:-61.60 },
  { en:'Guatemala',                    ru:'Гватемала',             iso2:'GT', num:320, lat:15.78, lng:-90.23 },
  { en:'Guinea',                       ru:'Гвинея',                iso2:'GN', num:324, lat:9.95, lng:-9.70 },
  { en:'Guinea-Bissau',                ru:'Гвинея-Бисау',          iso2:'GW', num:624, lat:11.80, lng:-15.18 },
  { en:'Guyana',                       ru:'Гайана',                iso2:'GY', num:328, lat:4.86, lng:-58.93 },
  { en:'Haiti',                        ru:'Гаити',                 iso2:'HT', num:332, lat:18.97, lng:-72.29 },
  { en:'Honduras',                     ru:'Гондурас',              iso2:'HN', num:340, lat:15.20, lng:-86.24 },
  { en:'Hong Kong',                    ru:'Гонконг',               iso2:'HK', num:344, lat:22.32, lng:114.17 },
  { en:'Hungary',                      ru:'Венгрия',               iso2:'HU', num:348, lat:47.16, lng:19.50 },
  { en:'Iceland',                      ru:'Исландия',              iso2:'IS', num:352, lat:64.96, lng:-19.02 },
  { en:'India',                        ru:'Индия',                 iso2:'IN', num:356, lat:20.59, lng:78.96 },
  { en:'Indonesia',                    ru:'Индонезия',             iso2:'ID', num:360, lat:-0.79, lng:113.92 },
  { en:'Iran',                         ru:'Иран',                  iso2:'IR', num:364, lat:32.43, lng:53.69 },
  { en:'Iraq',                         ru:'Ирак',                  iso2:'IQ', num:368, lat:33.22, lng:43.68 },
  { en:'Ireland',                      ru:'Ирландия',              iso2:'IE', num:372, lat:53.41, lng:-8.24 },
  { en:'Israel',                       ru:'Израиль',               iso2:'IL', num:376, lat:31.05, lng:34.85 },
  { en:'Italy',                        ru:'Италия',                iso2:'IT', num:380, lat:41.87, lng:12.57 },
  { en:'Ivory Coast',                  ru:"Кот-д'Ивуар",           iso2:'CI', num:384, lat:7.54, lng:-5.55 },
  { en:'Jamaica',                      ru:'Ямайка',                iso2:'JM', num:388, lat:18.11, lng:-77.30 },
  { en:'Japan',                        ru:'Япония',                iso2:'JP', num:392, lat:36.20, lng:138.25 },
  { en:'Jordan',                       ru:'Иордания',              iso2:'JO', num:400, lat:30.59, lng:36.24 },
  { en:'Kazakhstan',                   ru:'Казахстан',             iso2:'KZ', num:398, lat:48.02, lng:66.92 },
  { en:'Kenya',                        ru:'Кения',                 iso2:'KE', num:404, lat:-0.02, lng:37.91 },
  { en:'Kiribati',                     ru:'Кирибати',              iso2:'KI', num:296, lat:-3.37, lng:-168.73 },
  { en:'Kosovo',                       ru:'Косово',                iso2:'XK', num:0,   lat:42.60, lng:20.90 },
  { en:'Kuwait',                       ru:'Кувейт',                iso2:'KW', num:414, lat:29.31, lng:47.48 },
  { en:'Kyrgyzstan',                   ru:'Киргизия',              iso2:'KG', num:417, lat:41.20, lng:74.77 },
  { en:'Laos',                         ru:'Лаос',                  iso2:'LA', num:418, lat:19.86, lng:102.50 },
  { en:'Latvia',                       ru:'Латвия',                iso2:'LV', num:428, lat:56.88, lng:24.60 },
  { en:'Lebanon',                      ru:'Ливан',                 iso2:'LB', num:422, lat:33.85, lng:35.86 },
  { en:'Lesotho',                      ru:'Лесото',                iso2:'LS', num:426, lat:-29.61, lng:28.23 },
  { en:'Liberia',                      ru:'Либерия',               iso2:'LR', num:430, lat:6.43, lng:-9.43 },
  { en:'Libya',                        ru:'Ливия',                 iso2:'LY', num:434, lat:26.34, lng:17.23 },
  { en:'Liechtenstein',                ru:'Лихтенштейн',           iso2:'LI', num:438, lat:47.17, lng:9.56 },
  { en:'Lithuania',                    ru:'Литва',                 iso2:'LT', num:440, lat:55.17, lng:23.88 },
  { en:'Luxembourg',                   ru:'Люксембург',            iso2:'LU', num:442, lat:49.82, lng:6.13 },
  { en:'Madagascar',                   ru:'Мадагаскар',            iso2:'MG', num:450, lat:-18.77, lng:46.87 },
  { en:'Malawi',                       ru:'Малави',                iso2:'MW', num:454, lat:-13.25, lng:34.30 },
  { en:'Malaysia',                     ru:'Малайзия',              iso2:'MY', num:458, lat:4.21, lng:101.98 },
  { en:'Maldives',                     ru:'Мальдивы',              iso2:'MV', num:462, lat:3.20, lng:73.22 },
  { en:'Mali',                         ru:'Мали',                  iso2:'ML', num:466, lat:17.57, lng:-3.99 },
  { en:'Malta',                        ru:'Мальта',                iso2:'MT', num:470, lat:35.94, lng:14.38 },
  { en:'Marshall Islands',             ru:'Маршалловы Острова',    iso2:'MH', num:584, lat:7.13, lng:171.18 },
  { en:'Mauritania',                   ru:'Мавритания',            iso2:'MR', num:478, lat:21.01, lng:-10.94 },
  { en:'Mauritius',                    ru:'Маврикий',              iso2:'MU', num:480, lat:-20.35, lng:57.55 },
  { en:'Mexico',                       ru:'Мексика',               iso2:'MX', num:484, lat:23.63, lng:-102.55 },
  { en:'Micronesia',                   ru:'Микронезия',            iso2:'FM', num:583, lat:7.43, lng:150.55 },
  { en:'Moldova',                      ru:'Молдова',               iso2:'MD', num:498, lat:47.41, lng:28.37 },
  { en:'Monaco',                       ru:'Монако',                iso2:'MC', num:492, lat:43.75, lng:7.41 },
  { en:'Mongolia',                     ru:'Монголия',              iso2:'MN', num:496, lat:46.86, lng:103.85 },
  { en:'Montenegro',                   ru:'Черногория',            iso2:'ME', num:499, lat:42.71, lng:19.37 },
  { en:'Morocco',                      ru:'Марокко',               iso2:'MA', num:504, lat:31.79, lng:-7.09 },
  { en:'Mozambique',                   ru:'Мозамбик',              iso2:'MZ', num:508, lat:-18.67, lng:35.53 },
  { en:'Myanmar',                      ru:'Мьянма',                iso2:'MM', num:104, lat:21.91, lng:95.96 },
  { en:'Namibia',                      ru:'Намибия',               iso2:'NA', num:516, lat:-22.96, lng:18.49 },
  { en:'Nauru',                        ru:'Науру',                 iso2:'NR', num:520, lat:-0.52, lng:166.93 },
  { en:'Nepal',                        ru:'Непал',                 iso2:'NP', num:524, lat:28.39, lng:84.12 },
  { en:'Netherlands',                  ru:'Нидерланды',            iso2:'NL', num:528, lat:52.13, lng:5.29 },
  { en:'New Zealand',                  ru:'Новая Зеландия',        iso2:'NZ', num:554, lat:-40.90, lng:174.89 },
  { en:'Nicaragua',                    ru:'Никарагуа',             iso2:'NI', num:558, lat:12.87, lng:-85.21 },
  { en:'Niger',                        ru:'Нигер',                 iso2:'NE', num:562, lat:17.61, lng:8.08 },
  { en:'Nigeria',                      ru:'Нигерия',               iso2:'NG', num:566, lat:9.08, lng:8.68 },
  { en:'North Korea',                  ru:'Северная Корея',        iso2:'KP', num:408, lat:40.34, lng:127.51 },
  { en:'North Macedonia',              ru:'Северная Македония',    iso2:'MK', num:807, lat:41.61, lng:21.75 },
  { en:'Norway',                       ru:'Норвегия',              iso2:'NO', num:578, lat:60.47, lng:8.47 },
  { en:'Oman',                         ru:'Оман',                  iso2:'OM', num:512, lat:21.51, lng:55.92 },
  { en:'Pakistan',                     ru:'Пакистан',              iso2:'PK', num:586, lat:30.38, lng:69.35 },
  { en:'Palau',                        ru:'Палау',                 iso2:'PW', num:585, lat:7.51, lng:134.58 },
  { en:'Palestine',                    ru:'Палестина',             iso2:'PS', num:275, lat:31.95, lng:35.23 },
  { en:'Panama',                       ru:'Панама',                iso2:'PA', num:591, lat:8.54, lng:-80.78 },
  { en:'Papua New Guinea',             ru:'Папуа — Новая Гвинея',  iso2:'PG', num:598, lat:-6.31, lng:143.96 },
  { en:'Paraguay',                     ru:'Парагвай',              iso2:'PY', num:600, lat:-23.44, lng:-58.44 },
  { en:'Peru',                         ru:'Перу',                  iso2:'PE', num:604, lat:-9.19, lng:-75.02 },
  { en:'Philippines',                  ru:'Филиппины',             iso2:'PH', num:608, lat:12.88, lng:121.77 },
  { en:'Poland',                       ru:'Польша',                iso2:'PL', num:616, lat:51.92, lng:19.15 },
  { en:'Portugal',                     ru:'Португалия',            iso2:'PT', num:620, lat:39.40, lng:-8.22 },
  { en:'Qatar',                        ru:'Катар',                 iso2:'QA', num:634, lat:25.35, lng:51.18 },
  { en:'Romania',                      ru:'Румыния',               iso2:'RO', num:642, lat:45.94, lng:24.97 },
  { en:'Russia',                       ru:'Россия',                iso2:'RU', num:643, lat:61.52, lng:105.32 },
  { en:'Rwanda',                       ru:'Руанда',                iso2:'RW', num:646, lat:-1.94, lng:29.87 },
  { en:'Saint Kitts and Nevis',        ru:'Сент-Китс и Невис',     iso2:'KN', num:659, lat:17.36, lng:-62.78 },
  { en:'Saint Lucia',                  ru:'Сент-Люсия',            iso2:'LC', num:662, lat:13.91, lng:-60.98 },
  { en:'Saint Vincent and the Grenadines', ru:'Сент-Винсент и Гренадины', iso2:'VC', num:670, lat:12.98, lng:-61.29 },
  { en:'Samoa',                        ru:'Самоа',                 iso2:'WS', num:882, lat:-13.76, lng:-172.10 },
  { en:'San Marino',                   ru:'Сан-Марино',            iso2:'SM', num:674, lat:43.94, lng:12.46 },
  { en:'Sao Tome and Principe',        ru:'Сан-Томе и Принсипи',   iso2:'ST', num:678, lat:0.19, lng:6.61 },
  { en:'Saudi Arabia',                 ru:'Саудовская Аравия',     iso2:'SA', num:682, lat:23.89, lng:45.08 },
  { en:'Senegal',                      ru:'Сенегал',               iso2:'SN', num:686, lat:14.50, lng:-14.45 },
  { en:'Serbia',                       ru:'Сербия',                iso2:'RS', num:688, lat:44.02, lng:21.01 },
  { en:'Seychelles',                   ru:'Сейшелы',               iso2:'SC', num:690, lat:-4.68, lng:55.49 },
  { en:'Sierra Leone',                 ru:'Сьерра-Леоне',          iso2:'SL', num:694, lat:8.46, lng:-11.78 },
  { en:'Singapore',                    ru:'Сингапур',              iso2:'SG', num:702, lat:1.35, lng:103.82 },
  { en:'Slovakia',                     ru:'Словакия',              iso2:'SK', num:703, lat:48.67, lng:19.70 },
  { en:'Slovenia',                     ru:'Словения',              iso2:'SI', num:705, lat:46.15, lng:14.99 },
  { en:'Solomon Islands',              ru:'Соломоновы Острова',    iso2:'SB', num:90,  lat:-9.65, lng:160.16 },
  { en:'Somalia',                      ru:'Сомали',                iso2:'SO', num:706, lat:5.15, lng:46.20 },
  { en:'South Africa',                 ru:'ЮАР',                   iso2:'ZA', num:710, lat:-30.56, lng:22.94 },
  { en:'South Korea',                  ru:'Южная Корея',           iso2:'KR', num:410, lat:35.91, lng:127.77 },
  { en:'South Sudan',                  ru:'Южный Судан',           iso2:'SS', num:728, lat:6.88, lng:31.31 },
  { en:'Spain',                        ru:'Испания',               iso2:'ES', num:724, lat:40.46, lng:-3.75 },
  { en:'Sri Lanka',                    ru:'Шри-Ланка',             iso2:'LK', num:144, lat:7.87, lng:80.77 },
  { en:'Sudan',                        ru:'Судан',                 iso2:'SD', num:729, lat:12.86, lng:30.22 },
  { en:'Suriname',                     ru:'Суринам',               iso2:'SR', num:740, lat:3.92, lng:-56.03 },
  { en:'Sweden',                       ru:'Швеция',                iso2:'SE', num:752, lat:60.13, lng:18.64 },
  { en:'Switzerland',                  ru:'Швейцария',             iso2:'CH', num:756, lat:46.82, lng:8.23 },
  { en:'Syria',                        ru:'Сирия',                 iso2:'SY', num:760, lat:34.80, lng:38.99 },
  { en:'Taiwan',                       ru:'Тайвань',               iso2:'TW', num:158, lat:23.70, lng:120.96 },
  { en:'Tajikistan',                   ru:'Таджикистан',           iso2:'TJ', num:762, lat:38.86, lng:71.28 },
  { en:'Tanzania',                     ru:'Танзания',              iso2:'TZ', num:834, lat:-6.37, lng:34.89 },
  { en:'Thailand',                     ru:'Таиланд',               iso2:'TH', num:764, lat:15.87, lng:100.99 },
  { en:'Togo',                         ru:'Того',                  iso2:'TG', num:768, lat:8.62, lng:0.82 },
  { en:'Tonga',                        ru:'Тонга',                 iso2:'TO', num:776, lat:-21.18, lng:-175.20 },
  { en:'Trinidad and Tobago',          ru:'Тринидад и Тобаго',     iso2:'TT', num:780, lat:10.69, lng:-61.22 },
  { en:'Tunisia',                      ru:'Тунис',                 iso2:'TN', num:788, lat:33.89, lng:9.54 },
  { en:'Turkey',                       ru:'Турция',                iso2:'TR', num:792, lat:38.96, lng:35.24 },
  { en:'Turkmenistan',                 ru:'Туркменистан',          iso2:'TM', num:795, lat:38.97, lng:59.56 },
  { en:'Tuvalu',                       ru:'Тувалу',                iso2:'TV', num:798, lat:-7.11, lng:177.65 },
  { en:'Uganda',                       ru:'Уганда',                iso2:'UG', num:800, lat:1.37, lng:32.29 },
  { en:'Ukraine',                      ru:'Украина',               iso2:'UA', num:804, lat:48.38, lng:31.17 },
  { en:'United Arab Emirates',         ru:'ОАЭ',                   iso2:'AE', num:784, lat:23.42, lng:53.85 },
  { en:'United Kingdom',               ru:'Великобритания',        iso2:'GB', num:826, lat:55.38, lng:-3.44 },
  { en:'United States',                ru:'США',                   iso2:'US', num:840, lat:37.09, lng:-95.71 },
  { en:'Uruguay',                      ru:'Уругвай',               iso2:'UY', num:858, lat:-32.52, lng:-55.77 },
  { en:'Uzbekistan',                   ru:'Узбекистан',            iso2:'UZ', num:860, lat:41.38, lng:64.59 },
  { en:'Vanuatu',                      ru:'Вануату',               iso2:'VU', num:548, lat:-15.38, lng:166.96 },
  { en:'Vatican City',                 ru:'Ватикан',               iso2:'VA', num:336, lat:41.90, lng:12.45 },
  { en:'Venezuela',                    ru:'Венесуэла',             iso2:'VE', num:862, lat:6.42, lng:-66.59 },
  { en:'Vietnam',                      ru:'Вьетнам',               iso2:'VN', num:704, lat:14.06, lng:108.28 },
  { en:'Yemen',                        ru:'Йемен',                 iso2:'YE', num:887, lat:15.55, lng:48.52 },
  { en:'Zambia',                       ru:'Замбия',                iso2:'ZM', num:894, lat:-13.13, lng:27.85 },
  { en:'Zimbabwe',                     ru:'Зимбабве',              iso2:'ZW', num:716, lat:-19.02, lng:29.15 },
];

function flagEmoji(iso2){
  if(!iso2 || iso2.length !== 2) return '';
  const cc = iso2.toLowerCase();
  // Real flag icons (flagcdn, free SVG CDN) instead of emoji glyphs.
  return `<img src="https://flagcdn.com/${cc}.svg" alt="${iso2.toUpperCase()}" loading="lazy" ` +
         `style="width:22px;height:16px;border-radius:3px;object-fit:cover;vertical-align:middle;` +
         `box-shadow:0 0 0 1px rgba(0,0,0,.06)" ` +
         `onerror="this.style.display='none'">`;
}

const COUNTRY_BY_EN = Object.fromEntries(ALL_COUNTRIES.map(c => [c.en.toLowerCase(), c]));
const COUNTRY_BY_RU = Object.fromEntries(ALL_COUNTRIES.map(c => [c.ru.toLowerCase(), c]));
const COUNTRY_BY_ISO2 = Object.fromEntries(ALL_COUNTRIES.map(c => [c.iso2, c]));
function findCountry(name){
  if(!name) return null;
  // ISO2 shortcut — handles codes like 'TH', 'US' stored by external tools
  if(name.length === 2) return COUNTRY_BY_ISO2[name.toUpperCase()] || null;
  const k = name.toLowerCase();
  return COUNTRY_BY_EN[k] || COUNTRY_BY_RU[k] || null;
}

const REGION_RU = {
  'AFRO':'Африка','AMRO':'Америка','EMRO':'Вост. Средиземноморье',
  'EURO':'Европа','SEARO':'Юго-Вост. Азия','WPRO':'Зап. Пацифика',
  'Africa':'Африка','Americas':'Америка','Eastern Mediterranean':'Вост. Средиземноморье',
  'Europe':'Европа','South-East Asia':'Юго-Вост. Азия','Western Pacific':'Зап. Пацифика',
  'UNKNOWN':'Неизвестно',
};
function countryName(n){
  if(!n) return n;
  const c = findCountry(n);
  if(LANG === 'ru') return c ? c.ru : (COUNTRY_RU[n] || n);
  // EN: expand ISO2 to full name, pass full names through unchanged
  return c ? c.en : n;
}
function countryISO2(n){
  if(!n) return null;
  const c = findCountry(n);
  return c ? c.iso2 : null;
}
function regionName(r){  return LANG==='ru' ? (REGION_RU[r]||r)  : r; }

/* ── WHO status translation ───────────────────────────────── */
function translateWho(text){
  if(LANG !== 'ru' || !text) return text;
  return text
    .replace('Grade 3','Степень 3').replace('Grade 2','Степень 2').replace('Grade 1','Степень 1')
    .replace('PHEIC pending','ЧСЗМП рассматривается').replace('PHEIC active','ЧСЗМП активна')
    .replace('Regional emergency','Региональная ЧС').replace('Zoonotic','Зооноз')
    .replace('Belt season','Сезон менингопояса').replace('Endemic surveillance','Эндемичный мониторинг')
    .replace('Seasonal surveillance','Сезонный мониторинг').replace('live feed','живой фид')
    .replace('PAHO','ПАОЗ');
}

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

/* ── Travel advisory ─────────────────────────────────────── */
const TRAVEL_ADVISORY = {
  en: {
    high:   { label: 'Avoid non-essential travel', dot: '#C92A2A', bg: 'rgba(201,42,42,0.07)', border: 'rgba(201,42,42,0.20)' },
    medium: { label: 'Exercise increased caution', dot: '#C87B00', bg: 'rgba(200,123,0,0.07)', border: 'rgba(200,123,0,0.20)' },
    low:    { label: 'Normal precautions apply',   dot: '#3D8B5C', bg: 'rgba(61,139,92,0.07)', border: 'rgba(61,139,92,0.20)' },
  },
  ru: {
    high:   { label: 'Избегать несущественных поездок',  dot: '#C92A2A', bg: 'rgba(201,42,42,0.07)', border: 'rgba(201,42,42,0.20)' },
    medium: { label: 'Повышенная осторожность',           dot: '#C87B00', bg: 'rgba(200,123,0,0.07)', border: 'rgba(200,123,0,0.20)' },
    low:    { label: 'Стандартные меры предосторожности', dot: '#3D8B5C', bg: 'rgba(61,139,92,0.07)', border: 'rgba(61,139,92,0.20)' },
  },
};

const TREND_LABELS = {
  en: { rising:'↑ Worsening', stable:'→ Stable', falling:'↓ Improving' },
  ru: { rising:'↑ Ухудшается', stable:'→ Стабильно', falling:'↓ Улучшается' },
};

function trendDirection(trend){
  if(!trend || trend.length < 6) return 'stable';
  const recent  = trend.slice(-3).reduce((a,b)=>a+b,0) / 3;
  const earlier = trend.slice(0,3).reduce((a,b)=>a+b,0) / 3;
  if(earlier === 0) return recent > 0 ? 'rising' : 'stable';
  const pct = (recent - earlier) / earlier;
  if(pct >  0.12) return 'rising';
  if(pct < -0.12) return 'falling';
  return 'stable';
}

function countryTravelRisk(country){
  const threats = OUTBREAKS.filter(o => o.country === country);
  if(!threats.length) return 'low';
  const maxIdx = Math.max(...threats.map(o => SEV[o.sev]?.idx ?? 0));
  if(maxIdx >= 4) return 'high';
  if(maxIdx >= 2) return 'medium';
  return 'low';
}

/* Curated development / health-system baseline — NOT an official advisory.
   Used to normalise risk: the same nominal outbreak is far less dangerous to
   a traveller in a high-capacity country than in a fragile one. */
const BASELINE_LOW = new Set([
  'United States','Canada','United Kingdom','Ireland','Germany','France','Italy',
  'Spain','Portugal','Netherlands','Belgium','Luxembourg','Switzerland','Austria',
  'Sweden','Norway','Finland','Denmark','Iceland','Estonia','Latvia','Lithuania',
  'Poland','Czechia','Czech Republic','Slovakia','Slovenia','Hungary','Croatia',
  'Greece','Japan','South Korea','Korea, Republic of','Singapore','Taiwan',
  'Hong Kong','Australia','New Zealand','Israel','United Arab Emirates','Qatar',
  'Kuwait','Bahrain','Cyprus','Malta',
]);
const BASELINE_HIGH = new Set([
  'Afghanistan','Somalia','South Sudan','Sudan','Yemen','Syria',
  'Syrian Arab Republic','Democratic Republic of the Congo',
  'Democratic Republic of Congo','Central African Republic','Chad','Niger',
  'Mali','Burkina Faso','Haiti','Libya','Myanmar','Burundi','Eritrea',
  'Mozambique','Nigeria','Ethiopia','Venezuela',
]);
function countryBaselineRisk(country){
  if(BASELINE_LOW.has(country))  return 'low';
  if(BASELINE_HIGH.has(country)) return 'high';
  return 'medium';
}

/* Country transparency 0–1: how reliably does this country surface real
   signal? Bayesian core of the covert-risk engine — official silence is
   only evidence of a cover-up if the country would normally report.
   Closed regimes: silence is the baseline (likelihood ratio ≈ 1, ~0 bits). */
const TRANSPARENCY_OPAQUE = new Set([
  'North Korea','Korea, Democratic People\'s Republic of','Turkmenistan',
  'Eritrea','Syria','Syrian Arab Republic','Afghanistan',
]);
const TRANSPARENCY_SEMI = new Set([
  'Russia','China','Belarus','Iran','Iran, Islamic Republic of','Venezuela',
  'Myanmar','Tajikistan','Uzbekistan','Cuba','Laos','Lao People\'s Democratic Republic',
  'Equatorial Guinea','Azerbaijan','Nicaragua','Burundi',
]);
function countryTransparency(country){
  if(TRANSPARENCY_OPAQUE.has(country)) return 0.25;
  if(TRANSPARENCY_SEMI.has(country))   return 0.45;
  if(BASELINE_LOW.has(country))        return 0.92; // developed + free press + strong surveillance
  return 0.70;                                       // default — most countries
}
/* Capacity-aware effective tier: baseline blended with current worst *disease*
   severity. Strong-system countries absorb more before escalating. */
function countryRiskTier(country){
  const base = countryBaselineRisk(country);
  const dz = OUTBREAKS.filter(o => o.country===country &&
    (o.type||'epidemic')!=='air' && (o.type||'epidemic')!=='food');
  const worst = dz.reduce((m,o)=>Math.max(m, SEV[o.sev]?.idx ?? 0), 0);
  if(base==='low')  return worst>=5 ? 'medium' : 'low';
  if(base==='high') return worst>=2 ? 'high'   : 'medium';
  return worst>=4 ? 'high' : worst>=2 ? 'medium' : 'low';
}

let RISK_INDEX = {};          /* keyed by ISO-2, from public/risk_index.json */
let COUNTRY_SIGNALS = {};    /* indirect signals: connectivity, wastewater, currency — from public/country-signals.json */
let COUNTRY_STRUCTURAL = {}; /* INFORM structural indices — from public/country-structural.json */
let COUNTRY_MACRO = {};      /* macro indicators (GDP/debt/unemp/rate) — from public/macro.json. LAGGING signals: explainability primary */

/* ── Food Safety Recalls ─────────────────────────── */
let FOOD_RECALLS = [];
let _foodExpanded = false;
let _foodShowAll  = false;
const FOOD_PREVIEW = 6;   // cards shown before "show all"

const FLAG = iso2 => {
  if (!iso2 || iso2.length !== 2 || iso2 === 'EU') return iso2 === 'EU' ? '🇪🇺' : '';
  const o = 0x1F1E6 - 65;
  return String.fromCodePoint(iso2.charCodeAt(0) + o) + String.fromCodePoint(iso2.charCodeAt(1) + o);
};

/* A food recall → standard OUTBREAKS event (type:'food'), so it shows in
   the unified "Food" category list + detail panel like every other event. */
/* Short, localized ≤2-word label for a food hazard/disease.
   Derives a specific label from hazard+reason text; falls back to a
   clean generic so the RU UI never shows English or long strings. */
function shortFoodLabel(hazard, reason){
  const s = `${hazard||''} ${reason||''}`.toLowerCase();
  const M = [
    [/listeria|листери/,                         {en:'Listeria',    ru:'Листерия'}],
    [/salmonell|сальмонел/,                       {en:'Salmonella',  ru:'Сальмонелла'}],
    [/e\.?\s*coli|escherichia|stec|o157/,         {en:'E. coli',     ru:'E. coli'}],
    [/botulism|clostridium|ботулизм/,             {en:'Botulism',    ru:'Ботулизм'}],
    [/norovirus|норовирус/,                       {en:'Norovirus',   ru:'Норовирус'}],
    [/hepatitis\s*a|гепатит\s*a/,                 {en:'Hepatitis A', ru:'Гепатит A'}],
    [/cronobacter|кронобактер/,                   {en:'Cronobacter', ru:'Кронобактер'}],
    [/gluten|wheat|глютен|пшениц/,                {en:'Gluten',      ru:'Глютен'}],
    [/\bmilk|dairy|молок|молоч/,                  {en:'Milk allergen', ru:'Молоко'}],
    [/peanut|tree nut|\bnut\b|орех|арахис/,       {en:'Nut allergen',  ru:'Орехи'}],
    [/\bsoy|соя|соев/,                            {en:'Soy allergen',  ru:'Соя'}],
    [/\begg|яйц/,                                 {en:'Egg allergen',  ru:'Яйцо'}],
    [/sesame|кунжут/,                             {en:'Sesame',      ru:'Кунжут'}],
    [/shellfish|crustace|mollusc|моллюск|ракообраз/, {en:'Shellfish', ru:'Моллюски'}],
    [/\bfish|рыб/,                                {en:'Fish allergen', ru:'Рыба'}],
    [/sulphite|sulfite|сульфит/,                  {en:'Sulphites',   ru:'Сульфиты'}],
    [/undeclared|allergen|аллерг/,                {en:'Allergen',    ru:'Аллерген'}],
    [/metal|glass|plastic|foreign|посторон|металл|стекл|пластик/, {en:'Contamination', ru:'Загрязнение'}],
    [/insecurit|famine|hunger|голод|нехватк|продовольств/,        {en:'Food crisis',   ru:'Дефицит еды'}],
  ];
  for(const [re,lab] of M){ if(re.test(s)) return lab; }
  return { en:'Food recall', ru:'Отзыв продукта' };
}

/* Localized Russian hazard label for the finite food-hazard label set
   (from scripts/fetch_data.py FOOD_HAZARD_PATTERNS + RASFF/UK/CA passthrough).
   Falls back to shortFoodLabel for unknown strings so RU is never raw English. */
const FOOD_HAZARD_RU = {
  'Listeria':'Листерия', 'E. coli':'Кишечная палочка (E. coli)',
  'Salmonella':'Сальмонелла', 'Hepatitis A':'Гепатит A',
  'Botulism':'Ботулизм', 'Norovirus':'Норовирус',
  'Campylobacter':'Кампилобактер', 'Staphylococcus':'Стафилококк',
  'Allergen: Milk':'Аллерген: молоко', 'Allergen: Peanuts':'Аллерген: арахис',
  'Allergen: Tree nuts':'Аллерген: орехи', 'Allergen: Gluten':'Аллерген: глютен',
  'Allergen: Shellfish':'Аллерген: моллюски', 'Allergen: Fish':'Аллерген: рыба',
  'Allergen: Soy':'Аллерген: соя', 'Allergen: Eggs':'Аллерген: яйцо',
  'Allergen: Sesame':'Аллерген: кунжут', 'Undeclared allergen':'Незаявленный аллерген',
  'Foreign: Metal':'Посторонний предмет: металл',
  'Foreign: Glass':'Посторонний предмет: стекло',
  'Foreign: Plastic':'Посторонний предмет: пластик',
  'Chemical contamination':'Химическое загрязнение',
  'Mold/spoilage':'Плесень/порча', 'Food safety':'Пищевая безопасность',
};
function foodHazardRU(hazard, reason){
  if(hazard && FOOD_HAZARD_RU[hazard]) return FOOD_HAZARD_RU[hazard];
  return shortFoodLabel(hazard, reason).ru;
}
function foodHazardLoc(hazard, reason){
  return LANG==='ru' ? foodHazardRU(hazard, reason) : (hazard || 'Food safety');
}

function recallToEvent(r){
  const c = findCountry(r.country) ||
            (r.iso && typeof COUNTRY_BY_ISO2 !== 'undefined' ? COUNTRY_BY_ISO2[r.iso] : null);
  const lat = c?.lat ?? 50.0;          // EU / unknown → central Europe
  const lng = c?.lng ?? 10.0;
  const src  = r.source || 'Recall';
  const prod = (r.product || '').trim();
  const prodShort = prod.length > 38 ? prod.slice(0, 38).replace(/\s+\S*$/, '') + '…' : prod;
  const sum   = `${r.hazard || 'Food safety'} — ${prod}${r.reason ? '. ' + r.reason : ''}`.trim();
  const sumRu = `${foodHazardRU(r.hazard, r.reason)} — ${prod}`.trim();
  const sev  = ['critical','alert','warning','monitoring'].includes(r.severity) ? r.severity : 'warning';
  const country = r.country || (r.iso === 'EU' ? 'European Union' : '');
  const lab = shortFoodLabel(r.hazard, r.reason);
  const hzEn = r.hazard || lab.en;
  const hzRu = foodHazardRU(r.hazard, r.reason);
  return {
    id: r.id, type: 'food', _recall: true, _live: true,
    code: `RECALL-${src}-${(r.date||'').slice(0,10)}`,
    name:    prodShort ? `${hzEn} · ${prodShort}` : hzEn,
    name_ru: prodShort ? `${hzRu} · ${prodShort}` : hzRu,
    pathogen: r.hazard || 'Food safety',
    country,
    iso: c?.num || 0,
    region: 'UNKNOWN',
    place: country,
    lat, lng, lon: lng,
    sev,
    who: `${src}${r.class ? ' · ' + r.class : ''}`,
    cases: 0, deaths: 0, cfr: 0, rt: 0, new24: 0,
    sevIdx: { critical:80, alert:60, warning:40, monitoring:20 }[sev] || 40,
    trend: [0,0,0,0,0,0,0,0],
    blurb: sum, summary: sum, blurb_ru: sumRu, summary_ru: sumRu,
    events: [],
    link: r.link || '', _link: r.link || '',
    date: r.date || '',
  };
}

async function loadFoodRecalls() {
  try {
    const base = window.EPISWOPE_BASE || './';
    const res  = await fetch(base + 'public/food_recalls.json?_=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    // Collapse genuine duplicates: same hazard + product + country reported by
    // more than one feed (FDA/RASFF/UK/CA). Distinct cases are kept (product differs).
    const _seen = new Set();
    FOOD_RECALLS = (data.recalls || []).filter(r => {
      if (!r) return false;
      const k = `${(r.hazard||'').toLowerCase()}|${(r.product||'').slice(0,60).toLowerCase()}|${r.country||r.iso||''}`;
      if (_seen.has(k)) return false;
      _seen.add(k);
      return true;
    });

    // Merge recalls into OUTBREAKS as food events (idempotent on re-fetch)
    for (let i = OUTBREAKS.length - 1; i >= 0; i--) {
      if (OUTBREAKS[i]._recall) OUTBREAKS.splice(i, 1);
    }
    for (const r of FOOD_RECALLS) {
      if (!r || !r.id) continue;
      if (!OUTBREAKS.find(o => o.id === r.id)) OUTBREAKS.push(recallToEvent(r));
    }

    renderCatLists();
    renderList();
    if (typeof addGLMarkers === 'function') addGLMarkers();
    renderMyFeed();
  } catch (e) {
    console.warn('[Vigilo] food_recalls.json unavailable:', e.message);
  }
}

/* ── Historical data (public/history.json) ───────────────────── */
let HISTORY = null;
async function loadHistory() {
  try {
    const base = window.EPISWOPE_BASE || './';
    const res  = await fetch(base + 'public/history.json?_=' + Date.now());
    if (!res.ok) return;
    HISTORY = await res.json();
  } catch (e) {
    console.warn('[Vigilo] history.json unavailable:', e.message);
  }
}

/* Build a {dates:[], total:[], crit:[]} series for a country (or global). */
function historySeries(country) {
  if (!HISTORY || !HISTORY.daily) return null;
  const dates = Object.keys(HISTORY.daily).sort();
  if (!dates.length) return null;
  const total = [], crit = [], alert = [];
  for (const d of dates) {
    const day = HISTORY.daily[d];
    const bucket = country
      ? (day.countries && day.countries[country]) || {}
      : (day.g || {});
    total.push(bucket.t || 0);
    crit.push(bucket.c || 0);
    alert.push(bucket.a || 0);
  }
  return { dates, total, crit, alert };
}

/* Compact SVG area+line chart. series from historySeries(). */
function renderHistoryChart(s, color) {
  if (!s) return '';
  const w = 320, h = 96, pad = 6;
  const n = s.dates.length;
  const mx = Math.max(1, ...s.total);
  const sx = i => n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2);
  const sy = v => h - pad - (v / mx) * (h - pad * 2);
  const lineFor = arr => arr.map((v, i) => `${i ? 'L' : 'M'} ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
  const area = `M ${sx(0)} ${h - pad} ` +
    s.total.map((v, i) => `L ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ') +
    ` L ${sx(n - 1)} ${h - pad} Z`;
  const dot = (arr, c) => n === 1
    ? `<circle cx="${sx(0)}" cy="${sy(arr[0])}" r="3" fill="${c}"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:96px;display:block">
    <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#hg)"/>
    <path d="${lineFor(s.total)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${lineFor(s.crit)}" fill="none" stroke="#C92A2A" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.8"/>
    ${dot(s.total, color)}
  </svg>`;
}

function renderFoodAlerts() {
  const list     = document.getElementById('foodList');
  const totEl    = document.getElementById('foodTotalCount');
  const critEl   = document.getElementById('foodCritCount');
  if (!list) return;

  const total  = FOOD_RECALLS.length;
  const crits  = FOOD_RECALLS.filter(r => r.severity === 'critical').length;

  if (totEl) totEl.textContent = total || '—';
  if (critEl) {
    critEl.textContent = crits;
    critEl.style.display = crits > 0 ? '' : 'none';
  }

  if (!_foodExpanded) return;

  if (!total) {
    list.innerHTML = `<div class="food-empty">${LANG === 'ru' ? 'Нет активных отзывов' : 'No active recalls'}</div>`;
    return;
  }

  const shown = _foodShowAll ? FOOD_RECALLS : FOOD_RECALLS.slice(0, FOOD_PREVIEW);
  const cards = shown.map(r => {
    const flag   = r.iso === 'EU' ? '🇪🇺' : FLAG(r.iso);
    const dateStr = r.date ? r.date.slice(0, 10) : '';
    const src    = r.source || '';
    return `
      <div class="food-card" onclick="window.open('${r.link || '#'}','_blank')">
        <div class="food-card-head">
          <span class="food-hbadge ${r.severity}">${foodHazardLoc(r.hazard, r.reason)}</span>
          <span style="font-size:11px;color:var(--muted)">${flag} ${dateStr}</span>
        </div>
        <div class="food-product">${(r.product || '').slice(0, 90)}</div>
        <div class="food-meta">${src}${r.class ? ' · ' + r.class : ''}${r.scope ? ' · ' + r.scope.slice(0, 40) : ''}</div>
      </div>`;
  }).join('');

  const moreBtn = !_foodShowAll && total > FOOD_PREVIEW
    ? `<div class="food-see-all" onclick="event.stopPropagation();_foodShowAll=true;renderFoodAlerts()">
         ${LANG === 'ru' ? `Показать все ${total}` : `Show all ${total}`} ▾
       </div>` : '';

  list.innerHTML = cards + moreBtn;
}

function toggleFoodRecalls() {
  _foodExpanded = !_foodExpanded;
  const list = document.getElementById('foodList');
  const chev = document.getElementById('foodChev');
  if (list) list.style.display = _foodExpanded ? '' : 'none';
  if (chev) chev.style.transform = _foodExpanded ? 'rotate(180deg)' : '';
  if (_foodExpanded) renderFoodAlerts();
}

/* ── Watched regions (localStorage + server sync) ────────── */
let WATCHED = new Set(JSON.parse(localStorage.getItem('vigilo_watched') || '[]'));

/** Debounce timer for server sync */
let _syncTimer = null;

/** PATCH /api/my-countries with current WATCHED set (debounced 1s). */
function syncCountries() {
  const jwt = localStorage.getItem('vigilo_jwt');
  if (!jwt) return;                              // not logged in — no sync
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    try {
      await fetch('/api/my-countries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ countries: [...WATCHED] }),
      });
    } catch (e) {
      console.warn('syncCountries failed:', e.message);
    }
  }, 1000);
}

/** On login / page-load: pull server countries and merge into WATCHED.
 *  Server list wins for any country not already in local list. */
async function loadServerCountries() {
  const jwt = localStorage.getItem('vigilo_jwt');
  if (!jwt) return;
  try {
    const res  = await fetch('/api/my-countries', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.countries)) return;
    // Merge: union of local + server
    data.countries.forEach(c => WATCHED.add(c));
    localStorage.setItem('vigilo_watched', JSON.stringify([...WATCHED]));
    renderMyCountries();
    renderMyFeed();
    updateMobPeek();
  } catch (e) {
    console.warn('loadServerCountries failed:', e.message);
  }
}

function toggleWatch(country){
  if(!WATCHED.has(country) && !isPaid() && WATCHED.size >= FREE_COUNTRY_LIMIT){
    showProGate();
    return;
  }
  if(WATCHED.has(country)) WATCHED.delete(country);
  else { WATCHED.add(country); track('country_watched', { country }); }  // activation signal
  localStorage.setItem('vigilo_watched', JSON.stringify([...WATCHED]));
  renderMyCountries();
  renderMyFeed();
  syncCountries();  // push to server if logged in
  // additional re-render is triggered by the caller (renderPanel or renderCountryPanel)
}
function isWatched(country){ return WATCHED.has(country); }

/* ── Session / Auth ─────────────────────────────────────── */
const FREE_COUNTRY_LIMIT = 3;
const FREE_ASSESS_LIMIT = 10;

function getAssessQuota(){
  try { return parseInt(localStorage.getItem('vigilo_assess_left') ?? FREE_ASSESS_LIMIT, 10); }
  catch(e){ return FREE_ASSESS_LIMIT; }
}

function useAssessment(){
  const left = getAssessQuota();
  if(left <= 0) return false;
  localStorage.setItem('vigilo_assess_left', String(left - 1));
  updateAssessCounter();
  return true;
}

function updateAssessCounter(){
  const el = document.getElementById('assessCounter');
  if(!el) return;
  const left = getAssessQuota();
  const ru = LANG === 'ru';
  el.textContent = left > 0
    ? (ru ? `Осталось: ${left}` : `${left} left`)
    : (ru ? 'Лимит исчерпан' : 'Limit reached');
  el.style.color = left <= 2 ? 'var(--red, #C92A2A)' : 'var(--muted)';
}

function getSession() {
  try {
    const jwt = localStorage.getItem('vigilo_jwt');
    if (!jwt) return null;
    const [, body] = jwt.split('.');
    const payload = JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && payload.exp < Date.now() / 1000) {
      localStorage.removeItem('vigilo_jwt');
      return null;
    }
    return payload; // { email, plan, paid_until, iat, exp }
  } catch { return null; }
}

function isPaid() {
  const s = getSession();
  if (!s || s.plan !== 'pro') return false;
  return !s.paid_until || new Date(s.paid_until) > new Date();
}

function showProGate() {
  // Hot intent moment (free user hit country limit) → waitlist fake-door
  openProWaitlist('country_limit');
}

const _PRO_T = {
  en: {
    eyebrow: 'Vigilo Pro',
    title: 'Unlimited watchlist, real-time alerts &amp; PDF reports',
    price: '$4.99/mo',
    sub: 'Launching soon. Leave your email — get <b>50% off</b> at launch.',
    ph: 'your@email.com',
    cta: 'Join the waitlist',
    okT: 'You’re on the list ✓',
    okS: 'We’ll email you before launch with your 50% code.',
    feats: ['Unlimited watched countries', 'Real-time alerts (no 24h delay)', 'Personal risk radar by location', 'Monthly PDF risk reports', 'API access'],
  },
  ru: {
    eyebrow: 'Vigilo Pro',
    title: 'Безлимит стран, алерты в реальном времени и PDF-отчёты',
    price: '$4.99/мес',
    sub: 'Запускаем скоро. Оставь email — <b>−50%</b> на старте.',
    ph: 'ваш@email.com',
    cta: 'В список ожидания',
    okT: 'Ты в списке ✓',
    okS: 'Напишем перед запуском и пришлём код на −50%.',
    feats: ['Безлимит отслеживаемых стран', 'Алерты в реальном времени (без задержки 24ч)', 'Персональный радар рисков по локации', 'Ежемесячный PDF-отчёт по рискам', 'Доступ к API'],
  },
};

function openProWaitlist(source) {
  const L = _PRO_T[LANG === 'ru' ? 'ru' : 'en'];
  if (window.ym) ym(109240834, 'reachGoal', 'pro_open', { source: source || 'unknown' });

  let ov = document.getElementById('_proWaitOv');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = '_proWaitOv';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(8,7,6,.62);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s';
  ov.innerHTML = `
    <div id="_proWaitCard" style="background:var(--bg-card);max-width:420px;width:100%;border-radius:20px;padding:30px 28px;box-shadow:0 30px 70px -20px rgba(0,0,0,.4);transform:translateY(8px);transition:transform .22s">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#E8590C">${L.eyebrow}</span>
        <button id="_proWaitX" aria-label="close" style="border:0;background:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1;padding:2px 6px">×</button>
      </div>
      <div style="font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.25;color:var(--ink);margin-bottom:6px">${L.title}</div>
      <div style="font-size:13.5px;color:var(--ink-2);line-height:1.5;margin-bottom:16px"><b style="color:var(--ink)">${L.price}</b> · ${L.sub}</div>
      <ul style="list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:7px">
        ${L.feats.map(f => `<li style="font-size:12.5px;color:var(--ink-2);display:flex;gap:8px;align-items:flex-start"><span style="color:#19A463;font-weight:800;flex-shrink:0">✓</span>${f}</li>`).join('')}
      </ul>
      <form id="_proWaitForm" style="display:flex;flex-direction:column;gap:9px">
        <input id="_proWaitEmail" type="email" required placeholder="${L.ph}" autocomplete="email"
          style="height:46px;padding:0 15px;border:1.5px solid var(--line);border-radius:12px;font:inherit;font-size:14.5px;color:var(--ink);background:var(--bg-card);outline:none">
        <button type="submit" id="_proWaitBtn"
          style="height:46px;background:linear-gradient(180deg,#E8590C,#C92A2A);color:#fff;border:0;border-radius:12px;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer">${L.cta}</button>
      </form>
      <div id="_proWaitOk" style="display:none;text-align:center;padding:10px 0 2px">
        <div style="font-size:15px;font-weight:800;color:#19A463;margin-bottom:4px">${L.okT}</div>
        <div style="font-size:12.5px;color:var(--muted);line-height:1.5">${L.okS}</div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => {
    ov.style.opacity = '1';
    ov.querySelector('#_proWaitCard').style.transform = 'translateY(0)';
  });

  const close = () => { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 200); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('#_proWaitX').onclick = close;
  document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', esc); } });

  ov.querySelector('#_proWaitForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = ov.querySelector('#_proWaitEmail').value.trim();
    if (!email || !email.includes('@')) return;
    const btn = ov.querySelector('#_proWaitBtn');
    btn.disabled = true; btn.style.opacity = '.6';
    btn.textContent = LANG === 'ru' ? 'Отправляю…' : 'Sending…';
    try {
      await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: source || 'unknown', lang: LANG }),
      });
    } catch (_) {}
    if (window.ym) ym(109240834, 'reachGoal', 'pro_waitlist', { source: source || 'unknown' });
    ov.querySelector('#_proWaitForm').style.display = 'none';
    ov.querySelector('#_proWaitOk').style.display = 'block';
    setTimeout(close, 3200);
  });
}

/* ════════════════════════════════════════════════════════════
   RISK REPORT — purpose-tailored country assessment (Pro feature)
   ════════════════════════════════════════════════════════════ */
const _ICO = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const RISK_PURPOSES = [
  { id:'tourist',    en:'Tourist trip',  ru:'Турпоездка',
    icon:_ICO('<path d="M6 20a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M9 20v2M15 20v2"/>') },
  { id:'business',   en:'Business trip',  ru:'Командировка',
    icon:_ICO('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>') },
  { id:'relocation', en:'Relocation',     ru:'Переезд',
    icon:_ICO('<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>') },
  { id:'family',     en:'Family / kids', ru:'Семья / дети',
    icon:_ICO('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.6a4 4 0 0 1 0 7"/>') },
];

/* Emergency numbers by ISO2 (police/ambulance/fire). 112 = international
   fallback that works on most GSM networks worldwide. Curated set covers
   the high-travel countries; others fall back to 112. */
const EMERGENCY = {
  US:{p:'911',a:'911',f:'911'}, CA:{p:'911',a:'911',f:'911'},
  GB:{p:'999',a:'999',f:'999'}, IE:{p:'112',a:'112',f:'112'},
  AU:{p:'000',a:'000',f:'000'}, NZ:{p:'111',a:'111',f:'111'},
  RU:{p:'102',a:'103',f:'101'}, UA:{p:'102',a:'103',f:'101'},
  KZ:{p:'102',a:'103',f:'101'}, BY:{p:'102',a:'103',f:'101'},
  DE:{p:'110',a:'112',f:'112'}, FR:{p:'17',a:'15',f:'18'},
  ES:{p:'112',a:'112',f:'112'}, IT:{p:'112',a:'118',f:'115'},
  NL:{p:'112',a:'112',f:'112'}, BE:{p:'112',a:'112',f:'112'},
  CH:{p:'117',a:'144',f:'118'}, AT:{p:'133',a:'144',f:'122'},
  SE:{p:'112',a:'112',f:'112'}, NO:{p:'112',a:'113',f:'110'},
  DK:{p:'112',a:'112',f:'112'}, FI:{p:'112',a:'112',f:'112'},
  PL:{p:'112',a:'112',f:'112'}, PT:{p:'112',a:'112',f:'112'},
  GR:{p:'100',a:'166',f:'199'}, CZ:{p:'112',a:'112',f:'112'},
  TR:{p:'112',a:'112',f:'112'}, IL:{p:'100',a:'101',f:'102'},
  AE:{p:'999',a:'998',f:'997'}, SA:{p:'999',a:'997',f:'998'},
  EG:{p:'122',a:'123',f:'180'}, ZA:{p:'10111',a:'10177',f:'10177'},
  NG:{p:'112',a:'112',f:'112'}, KE:{p:'999',a:'999',f:'999'},
  IN:{p:'112',a:'112',f:'112'}, CN:{p:'110',a:'120',f:'119'},
  JP:{p:'110',a:'119',f:'119'}, KR:{p:'112',a:'119',f:'119'},
  TH:{p:'191',a:'1669',f:'199'}, VN:{p:'113',a:'115',f:'114'},
  ID:{p:'110',a:'118',f:'113'}, PH:{p:'911',a:'911',f:'911'},
  MY:{p:'999',a:'999',f:'994'}, SG:{p:'999',a:'995',f:'995'},
  BD:{p:'999',a:'999',f:'999'}, PK:{p:'15',a:'1122',f:'16'},
  BR:{p:'190',a:'192',f:'193'}, MX:{p:'911',a:'911',f:'911'},
  AR:{p:'911',a:'107',f:'100'}, CL:{p:'133',a:'131',f:'132'},
  CO:{p:'123',a:'123',f:'123'}, PE:{p:'105',a:'106',f:'116'},
  MA:{p:'19',a:'15',f:'15'},   DZ:{p:'17',a:'14',f:'14'},
};
const EMERGENCY_DEFAULT = { g:'112' };

function emergencyFor(iso2){
  const e = iso2 && EMERGENCY[iso2];
  return e || EMERGENCY_DEFAULT;
}

/* Section header: small accent icon + uppercase label + thin rule */
function _sec(label, svgPath){
  return `<div style="display:flex;align-items:center;gap:7px;margin:20px 0 9px">
    <span style="color:#E8590C;display:flex"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg></span>
    <span style="font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">${label}</span>
    <span style="flex:1;height:1px;background:var(--line)"></span>
  </div>`;
}

function _riskVerdict(country, outbreaks){
  const worstIdx = outbreaks.reduce((m,o)=> Math.max(m, SEV[o.sev]?.idx ?? 0), 0);
  const risk = countryRiskTier(country);
  const map = {
    en:{ low:'Low risk', medium:'Moderate risk', high:'High risk', extreme:'Severe risk' },
    ru:{ low:'Низкий риск', medium:'Умеренный риск', high:'Высокий риск', extreme:'Серьёзный риск' },
  };
  let lvl = risk;                              // capacity-aware tier
  if(risk==='high' && worstIdx >= 5) lvl='extreme';   // genuine catastrophe only
  const color = {low:'#19A463', medium:'#E4B514', high:'#E8590C', extreme:'#C92A2A'}[lvl];
  return { lvl, color, label:(map[LANG==='ru'?'ru':'en'])[lvl] };
}

/* Composite 0-100 risk score from all signals + component breakdown.
   Incorporates: outbreaks, health baseline, air, food, trend,
   + indirect signals from RISK_INDEX: conflict, civil unrest, blackout/infrastructure. */
function _riskScore({ obs, country, air, recalls, hs }){
  const ru = LANG==='ru';
  const iso2 = findCountry(country)?.iso2;
  const ri   = iso2 ? RISK_INDEX[iso2] : null;  // risk_index.json data for this country

  // Disease/disaster only — air & food have their own components (no triple-count).
  const dz = obs.filter(o => { const t=o.type||'epidemic'; return t!=='air' && t!=='food'; });
  const worstIdx = dz.reduce((m,o)=> Math.max(m, SEV[o.sev]?.idx ?? 0), 0);
  const serious  = dz.filter(o => (SEV[o.sev]?.idx ?? 0) >= 3).length;

  // Health-system capacity factor
  const base = countryBaselineRisk(country);
  const cap  = base==='low' ? 0.42 : base==='high' ? 1.12 : 0.82;
  const sevPts = Math.max(0, Math.min(42,
    (worstIdx/5)*40*cap + Math.min(serious*2, 6)*cap));

  // Honest baseline (development + health system)
  const advPts  = base==='high' ? 24 : base==='medium' ? 13 : 4;
  const advBump = worstIdx>=5 ? 5 : worstIdx>=4 ? 2 : 0;

  // Air quality
  const aqiPts  = air==null ? 3 : Math.max(0, Math.min(12, (air-40)/160*12));

  // Food
  const foodIns = dz.some(o=>/insecur|food crisis|дефицит еды|нехватк/i.test((o.name||'')+(o.name_ru||'')));
  const foodCap = base==='low' ? 0.5 : base==='high' ? 1 : 0.85;
  const foodPts = Math.min(8, (recalls.length*1.5 + (foodIns?5:0)) * foodCap);

  // Trend
  let trendPts = 0, trendLbl = ru?'стабилен':'stable';
  if(hs && hs.total.length>1){
    const d=(hs.total[hs.total.length-1]||0)-(hs.total[0]||0);
    if(d>0){ trendPts=5; trendLbl=ru?'растёт':'rising'; }
    else if(d<0){ trendPts=-3; trendLbl=ru?'снижается':'falling'; }
  }

  // ── Indirect signals from RISK_INDEX ─────────────────────────
  // Conflict: armed clashes, kinetic strikes (0-5 scale → 0-10 pts)
  const conflictRaw  = ri?.category_breakdown?.conflict?.score     || 0;
  const unrestRaw    = ri?.category_breakdown?.civil_unrest?.score  || 0;
  const infraRaw     = ri?.category_breakdown?.infrastructure?.score|| 0;
  const borderRaw    = ri?.category_breakdown?.border?.score        || 0;
  const conflictPts  = Math.min(10, (conflictRaw / 5) * 10);
  const unrestPts    = Math.min(6,  (unrestRaw   / 5) * 6);
  let   blackoutPts  = Math.min(5,  (infraRaw    / 5) * 5);
  const borderPts    = Math.min(4,  (borderRaw   / 5) * 4);

  // ── Indirect signals from COUNTRY_SIGNALS ─────────────────────
  const cs = iso2 ? COUNTRY_SIGNALS[iso2] : null;
  // Internet shutdown → boost blackout component
  if(cs?.internet?.shutdown){
    const sev = { severe:3, elevated:2, moderate:1 }[cs.internet.severity] || 0;
    blackoutPts = Math.min(5, blackoutPts + sev);
  }
  if(cs?.power_grid?.alert){
    const sev = { critical:2, elevated:1 }[cs.power_grid.severity] || 0.5;
    blackoutPts = Math.min(5, blackoutPts + sev);
  }
  // Wastewater signal → early disease signal (small boost to outbreak component)
  const wastewaterBoost = cs?.wastewater?.alert
    ? ({ critical:4, moderate:2, low:1 }[cs.wastewater.severity] || 1)
    : 0;
  // Currency: FLOW not STOCK — recent velocity + acceleration, not cumulative.
  // Chronic weakness (e.g. Venezuela -99% for years) is background, not signal.
  const fxFlow = cs?.currency?.drop_30d_pct || 0;
  let currencyBoost = fxFlow >= 20 ? 4 : fxFlow >= 12 ? 3 : fxFlow >= 6 ? 1.5 : fxFlow >= 3 ? 0.5 : 0;
  if(cs?.currency?.accelerating && currencyBoost > 0) currencyBoost = Math.min(4, currencyBoost + 1);

  // ── Macro layer (lagging, explainability primary, small score weight) ──
  // Flow-discipline: rate-of-change matters more than levels.
  const cm = iso2 ? COUNTRY_MACRO[iso2] : null;
  let macroPts = 0;
  const macroBits = [];
  if(cm){
    if(cm.gdp_yoy_pct != null && cm.gdp_yoy_pct < 0){
      const m = cm.gdp_yoy_pct <= -5 ? 2.5 : cm.gdp_yoy_pct <= -2 ? 1.5 : 0.8;
      macroPts += m; macroBits.push((ru?'ВВП ':'GDP ')+cm.gdp_yoy_pct+'%');
    }
    if(cm.unemp_2yr_delta_pp != null && cm.unemp_2yr_delta_pp >= 2){
      macroPts += 0.8; macroBits.push((ru?'безработ. +':'unemp +')+cm.unemp_2yr_delta_pp+'pp');
    }
    if(cm.debt_5yr_delta_pp != null && cm.debt_5yr_delta_pp >= 25){
      macroPts += 0.7; macroBits.push((ru?'долг +':'debt +')+cm.debt_5yr_delta_pp+'pp/5y');
    }
    if(cm.policy_rate_pct != null && cm.policy_rate_pct >= 20){
      macroPts += 0.5; macroBits.push((ru?'ставка ':'rate ')+cm.policy_rate_pct+'%');
    }
  }
  macroPts = Math.min(4, +macroPts.toFixed(1));

  const raw = sevPts + advPts + advBump + aqiPts + foodPts + trendPts
            + conflictPts + unrestPts + blackoutPts + borderPts
            + wastewaterBoost + currencyBoost + macroPts;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const band = score>=75 ? {k:'severe',  c:'#C92A2A', en:'Severe',   ru:'Серьёзный'}
             : score>=50 ? {k:'high',    c:'#E8590C', en:'High',     ru:'Высокий'}
             : score>=25 ? {k:'moderate',c:'#E4B514', en:'Moderate', ru:'Умеренный'}
             :             {k:'low',     c:'#19A463', en:'Low',      ru:'Низкий'};

  const parts = [
    { l: ru?'Вспышки':'Outbreaks',      v: Math.round(sevPts),       max:42, c:'#C92A2A',
      desc: ru?'Тяжесть вспышек с поправкой на систему здравоохранения':'Outbreak severity, adjusted for health-system capacity' },
    { l: ru?'Базовый риск':'Baseline',  v: Math.round(advPts+advBump), max:29, c:'#E8590C',
      desc: ru?'Развитость и система здравоохранения (не офиц. рекомендация)':'Development & health-system baseline (not an official advisory)' },
    ...(conflictPts > 0 ? [{ l: ru?'Конфликт':'Conflict', v: Math.round(conflictPts), max:10, c:'#7C3AED',
      desc: ru?'Вооружённые столкновения и активные боевые действия (ACLED/GDELT)':'Armed clashes and active hostilities (ACLED/GDELT)' }] : []),
    ...(unrestPts > 0   ? [{ l: ru?'Беспорядки':'Unrest',  v: Math.round(unrestPts),  max:6,  c:'#9333EA',
      desc: ru?'Протесты, гражданские волнения, беспорядки':'Protests, civil unrest, demonstrations' }] : []),
    ...(blackoutPts > 0 ? [{ l: ru?'Блэкаут':'Blackout',   v: Math.round(blackoutPts),max:5,  c:'#B45309',
      desc: ru?'Отключения интернета, электросети и инфраструктуры связи':'Internet shutdowns, power grid and connectivity outages' }] : []),
    ...(borderPts > 0   ? [{ l: ru?'Граница':'Border',     v: Math.round(borderPts),  max:4,  c:'#0369A1',
      desc: ru?'Ограничения въезда, закрытые границы, контроль':'Entry restrictions, closed borders, enhanced checks' }] : []),
    { l: ru?'Воздух':'Air quality',     v: Math.round(aqiPts),       max:12, c:'#6B7F3A',
      desc: ru?'Качество воздуха (индекс AQI)':'Air quality (AQI index)' },
    { l: ru?'Еда':'Food',               v: Math.round(foodPts),      max:8,  c:'#A0522D',
      desc: ru?'Отзывы продуктов и продовольственный кризис':'Food recalls and food-insecurity crisis' },
    { l: ru?'Тренд':'Trend',            v: trendPts,                 max:5,  c:'#1D6FA4', note: trendLbl,
      desc: ru?'Динамика угроз за период (растёт/снижается)':'Threat dynamics over time (rising/falling)' },
    ...(wastewaterBoost > 0 ? [{ l: ru?'Сточные воды':'Wastewater', v: wastewaterBoost, max:4, c:'#0891B2',
      desc: ru ? `Сигнал в сточных водах: ${cs?.wastewater?.source||'CDC/ECDC'} — ранний индикатор до клинических случаев`
               : `Wastewater signal: ${cs?.wastewater?.source||'CDC/ECDC'} — early indicator ahead of clinical cases` }] : []),
    ...(currencyBoost > 0 ? [{ l: ru?'Валюта':'Currency',           v: Math.round(currencyBoost), max:4, c:'#DC2626',
      note: (cs?.currency?.accelerating ? '↑' : ''),
      desc: ru ? `Валюта −${fxFlow}% за 30 дней${cs?.currency?.accelerating?' (ускоряется)':''} — скорость падения, а не накопленный фон`
               : `Currency −${fxFlow}% in 30 days${cs?.currency?.accelerating?' (accelerating)':''} — rate of decline, not cumulative background` }] : []),
    ...(macroPts > 0 ? [{ l: ru?'Макро':'Macro', v: macroPts, max:4, c:'#7C2D12',
      desc: ru
        ? `Макро (запаздывающее, для объяснимости): ${macroBits.join(' · ')}`
        : `Macro (lagging, explainability): ${macroBits.join(' · ')}` }] : []),
  ];
  return { score, band, parts };
}

/* ═══════════════════════════════════════════════════════════════════
   OSINT SHADOW ENGINE — private observation mode (owner only)
   Deterministic covert-risk detection from signals we already load.
   Does NOT dispatch anything. Only logs to localStorage for validation.
   ═══════════════════════════════════════════════════════════════════ */

/* Owner gate: admin JWT OR manual flag. Fully private — never shown to
   regular users. Toggle in console: localStorage.vigilo_osint='1' */
function isOsintObserver(){
  try{
    if(localStorage.getItem('vigilo_osint') === '1') return true;
    const s = (typeof getSession === 'function') ? getSession() : null;
    return s?.b2b_role === 'b2b_admin';
  }catch(_){ return false; }
}

/* Deterministic covert-risk verdict for a country.
   Core idea: behavioral/indirect signals HIGH while official health
   activity LOW  →  "officially quiet but behaviorally loud" = covert risk. */
function computeCovertRisk(country){
  const iso2 = findCountry(country)?.iso2;
  const ri   = iso2 ? RISK_INDEX[iso2] : null;
  const cs   = iso2 ? COUNTRY_SIGNALS[iso2] : null;
  const cb   = ri?.category_breakdown || {};

  const conflict = cb.conflict?.score      || 0;   // 0-5
  const unrest   = cb.civil_unrest?.score  || 0;
  const border   = cb.border?.score        || 0;
  let   infra    = cb.infrastructure?.score|| 0;

  // Boost infra by hard connectivity/power signals
  if(cs?.internet?.shutdown){
    infra += ({ severe:2, elevated:1.3, moderate:0.7 }[cs.internet.severity] || 0);
  }
  if(cs?.power_grid?.alert){
    infra += ({ critical:1.5, elevated:1 }[cs.power_grid.severity] || 0.5);
  }
  infra = Math.min(5, infra);

  // Currency: FLOW not STOCK — 30-day velocity + acceleration (Meadows fix).
  // Chronic hyperinflation (Venezuela) is steady-state background, not a covert signal.
  const fxFlow = cs?.currency?.drop_30d_pct || 0;
  let currencyIdx = fxFlow >= 20 ? 5 : fxFlow >= 12 ? 3.5 : fxFlow >= 6 ? 2 : fxFlow >= 3 ? 1 : 0;
  if(cs?.currency?.accelerating && currencyIdx > 0) currencyIdx = Math.min(5, currencyIdx + 0.5);

  // Weighted behavioral index (0-5)
  const behavioralRaw = Math.min(5,
      0.30*conflict + 0.20*unrest + 0.22*infra + 0.16*currencyIdx + 0.12*border);

  // INFORM structural modifier (must match server osint-engine.mjs exactly):
  // F = clamp((vuln*coping)/100,0,1); M = clamp(0.70 + F*1.6, 0.70, 1.60)
  const _st = COUNTRY_STRUCTURAL[iso2];
  let informM = 1.0;
  if(_st && _st.vulnerability != null && _st.coping != null){
    const F = Math.max(0, Math.min(1, (_st.vulnerability * _st.coping) / 100));
    informM = +Math.max(0.70, Math.min(1.60, 0.70 + F * 1.6)).toFixed(3);
  }
  const behavioral = +Math.min(5, behavioralRaw * informM).toFixed(2);

  // Official health activity (the "is it officially loud?" denominator)
  const healthScore = cb.health?.score || 0;
  const liveEpi = OUTBREAKS.filter(o =>
    o.country === country && (!o.type || o.type === 'epidemic')).length;
  const officialActivity = healthScore + Math.min(2, liveEpi * 0.4);

  const divergence = +(behavioral - officialActivity).toFixed(2);

  // ── Bayesian transparency discount ───────────────────────────
  // Official silence is evidence of a cover-up ONLY in proportion to how
  // reliably the country normally reports. In an opaque regime, silence is
  // the baseline (P(silent|crisis) ≈ P(silent|no crisis) ≈ 1 → ~0 bits),
  // so we must NOT read "officially quiet" as a covert signal there.
  const transparency = countryTransparency(country);
  const silenceInformative = officialActivity <= 1.0 ? transparency : 1;
  const adjDivergence = +(divergence * silenceInformative).toFixed(2);

  // Deterministic tiering — fixed cut points (now on adjusted divergence)
  let tier;
  if(behavioral >= 3.5 && officialActivity <= 1.0 && adjDivergence >= 2.5)
       tier = 'covert_elevated';     // genuinely anomalous silence + loud behavior
  else if(behavioral >= 3.0)
       tier = 'elevated_watch';
  else tier = 'nominal';
  // Opacity-suppressed: would have flagged covert but country is too closed
  // to treat silence as informative — log it so we can study these.
  const opacitySuppressed =
    behavioral >= 3.5 && officialActivity <= 1.0 && divergence >= 2.5
    && tier !== 'covert_elevated';

  const reasons = [];
  if(conflict   >= 2) reasons.push({ k:'conflict',  v:conflict.toFixed(1),  src:'risk_index' });
  if(unrest     >= 2) reasons.push({ k:'unrest',    v:unrest.toFixed(1),    src:'risk_index' });
  if(cs?.internet?.shutdown) reasons.push({ k:'internet_shutdown', v:cs.internet.severity, src:cs.internet.source });
  if(cs?.power_grid?.alert)  reasons.push({ k:'power_grid', v:cs.power_grid.severity, src:'grid' });
  if(fxFlow >= 6)     reasons.push({ k:'currency_30d', v:'-'+fxFlow+'%'+(cs?.currency?.accelerating?'↑':''), src:cs?.currency?.source||'IMF' });
  if(border     >= 2) reasons.push({ k:'border',    v:border.toFixed(1),    src:'risk_index' });
  if(informM !== 1.0) reasons.push({ k:'inform',     v:'M='+informM,         src:'INFORM' });
  if(opacitySuppressed)
    reasons.push({ k:'opacity_suppressed', v:'T='+transparency, src:'bayes' });

  return { iso2, country, tier,
           behavioralRaw:+behavioralRaw.toFixed(2), behavioral:+behavioral.toFixed(2), informM,
           officialActivity:+officialActivity.toFixed(2),
           divergence, adjDivergence, transparency, opacitySuppressed, reasons };
}

/* Auto-accumulate observations on the owner's browser (one snapshot per
   country per day). Later: export & compare predicted vs what happened. */
function logOsintObservation(v){
  if(!v || v.tier === 'nominal') return;
  try{
    const KEY = 'vigilo_osint_journal';
    const day = new Date().toISOString().slice(0,10);
    const log = JSON.parse(localStorage.getItem(KEY) || '[]');
    if(log.some(e => e.day === day && e.iso2 === v.iso2)) return; // dedup
    log.push({ day, iso2:v.iso2, country:v.country, tier:v.tier,
               behavioral:v.behavioral, officialActivity:v.officialActivity,
               divergence:v.divergence, adjDivergence:v.adjDivergence,
               transparency:v.transparency, opacitySuppressed:v.opacitySuppressed,
               reasons:v.reasons.map(r=>r.k+':'+r.v),
               ts:Date.now(), outcome:null });   // outcome filled later by review
    localStorage.setItem(KEY, JSON.stringify(log.slice(-500)));
  }catch(_){}
}

/* One-line export for pasting back to Claude for validation review. */
window.osintJournal = function(){
  try{
    const log = JSON.parse(localStorage.getItem('vigilo_osint_journal') || '[]');
    console.log('[Vigilo OSINT journal] '+log.length+' observations');
    console.table(log);
    return JSON.stringify(log);
  }catch(_){ return '[]'; }
};

/* Render the private observer panel (owner only). Quiet, dashed style —
   visually distinct from verified domains so we never confuse the two. */
function osintObserverPanel(country){
  if(!isOsintObserver()) return '';
  const v = computeCovertRisk(country);
  logOsintObservation(v);
  const ru = LANG === 'ru';

  const TIER = {
    covert_elevated: { c:'#B45309', en:'Covert risk — officially quiet, behaviorally loud',
                                     ru:'Скрытый риск — официально тихо, поведенчески громко' },
    elevated_watch:  { c:'#9333EA', en:'Elevated watch',  ru:'Повышенное наблюдение' },
    nominal:         { c:'#807E76', en:'Nominal',         ru:'В норме' },
  };
  const t = TIER[v.tier];
  const reasonRow = v.reasons.length
    ? v.reasons.map(r =>
        `<span style="display:inline-block;font-size:10.5px;background:rgba(180,83,9,.10);color:#B45309;border:1px solid rgba(180,83,9,.22);border-radius:6px;padding:2px 7px;margin:2px 4px 2px 0">${r.k} · ${r.v}</span>`
      ).join('')
    : `<span style="font-size:11px;color:var(--muted)">${ru?'нет активных косвенных сигналов':'no active indirect signals'}</span>`;

  return `
    <div class="cp-section" style="border:1px dashed rgba(180,83,9,.4);border-radius:12px;background:rgba(180,83,9,.04);margin-top:10px">
      <div class="cp-section-title" style="display:flex;align-items:center;gap:6px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ${ru?'OSINT · приватное наблюдение':'OSINT · private observation'}
      </div>
      <div style="font-size:13px;font-weight:700;color:${t.c};margin:4px 0 8px">${ru?t.ru:t.en}</div>
      <div style="display:flex;gap:14px;font-size:11px;color:var(--muted);margin-bottom:6px;flex-wrap:wrap">
        <span title="${ru?'сырой сигнал → после INFORM-модификатора':'raw signal → after INFORM modifier'}">${ru?'Поведенч.':'Behavioral'}: <b style="color:#14110C">${v.behavioral}</b>/5${v.informM!==1?` <span style="color:var(--muted)">(${v.behavioralRaw}×${v.informM})</span>`:''}</span>
        <span>${ru?'Официально':'Official'}: <b style="color:#14110C">${v.officialActivity}</b>/5</span>
        <span title="${ru?'надёжность раскрытия данных страной':'how reliably the country surfaces signal'}">${ru?'Прозрачность':'Transparency'}: <b style="color:#14110C">${v.transparency}</b></span>
      </div>
      <div style="display:flex;gap:14px;font-size:11px;color:var(--muted);margin-bottom:8px;flex-wrap:wrap">
        <span>${ru?'Расхожд. сырое':'Divergence raw'}: <b style="color:var(--muted)">${v.divergence>0?'+':''}${v.divergence}</b></span>
        <span title="${ru?'после байесовской поправки на прозрачность':'after Bayesian transparency discount'}">${ru?'скорр.':'adjusted'}: <b style="color:${v.adjDivergence>=2.5?'#B45309':'#14110C'}">${v.adjDivergence>0?'+':''}${v.adjDivergence}</b></span>
        ${v.opacitySuppressed ? `<span style="color:#9333EA;font-weight:600">${ru?'подавлено непрозрачностью':'opacity-suppressed'}</span>` : ''}
      </div>
      <div>${reasonRow}</div>
      <div class="cp-prov" style="margin-top:8px">${ru
        ? 'Только для владельца. Не рассылается. Журнал копится локально — <code>osintJournal()</code> в консоли для экспорта.'
        : 'Owner-only. Never dispatched. Journal accumulates locally — call <code>osintJournal()</code> in console to export.'}</div>
    </div>`;
}

/* Pro semicircle gauge (SVG). 0-100, colored arc + needle + big number. */
function _riskGauge(score, color, label){
  const W=240, H=140, cx=120, cy=124, r=92, sw=16;
  const pol = (deg)=>{ const a=(180-deg)*Math.PI/180; return [cx + r*Math.cos(a), cy - r*Math.sin(a)]; };
  const arc = (d0,d1)=>{ const [x0,y0]=pol(d0), [x1,y1]=pol(d1); const large = (d1-d0)>180?1:0; return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const deg = score/100*180;
  const [nx,ny] = pol(deg);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:200px;max-width:100%;display:block;margin:2px auto 0">
    <path d="${arc(0,180)}" fill="none" stroke="var(--line)" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="${arc(0,Math.max(0.5,deg))}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#0F0E0C" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#0F0E0C"/>
    <text x="${cx}" y="${cy-22}" text-anchor="middle" font-family="Inter,sans-serif" font-size="40" font-weight="900" fill="#0F0E0C">${score}</text>
    <text x="${cx}" y="${cy-4}" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="700" fill="${color}" letter-spacing="0.5">${label.toUpperCase()}</text>
  </svg>`;
}

function _purposeGuidance(purpose, country, outbreaks){
  const ru = LANG==='ru';
  const hasResp = outbreaks.some(o=>/flu|influenza|covid|measles|respir|tubercul|грипп|корь|тубер/i.test(o.name||o.disease||''));
  const hasVec  = outbreaks.some(o=>/dengue|malaria|zika|chikungunya|yellow fever|denge|маляри|лихорад/i.test(o.name||o.disease||''));
  const hasGI   = outbreaks.some(o=>/cholera|salmonell|e\.?\s*coli|hepatitis a|typhoid|холер|сальмонелл|тиф|гепатит a/i.test(o.name||o.disease||''));
  const L=[];
  if(purpose==='tourist'){
    L.push(ru?'Сделайте прививки из списка ниже за 4–6 недель до поездки.':'Get the vaccines listed below 4–6 weeks before travel.');
    if(hasVec) L.push(ru?'Активны трансмиссивные инфекции — репелленты, одежда с длинным рукавом, антимоскитные сетки.':'Vector-borne disease active — repellent, long sleeves, bed nets.');
    if(hasGI)  L.push(ru?'Риск кишечных инфекций — только бутилированная вода, термически обработанная еда.':'Foodborne risk — bottled water only, well-cooked food.');
    L.push(ru?'Оформите страховку с медицинской эвакуацией.':'Get travel insurance with medical evacuation cover.');
  } else if(purpose==='business'){
    L.push(ru?'Duty of care: уведомьте HR/безопасность о поездке, маршруте и сроках.':'Duty of care: notify HR/security of trip, route and dates.');
    L.push(ru?'Подготовьте план эвакуации и контакты ближайшей клиники международного уровня.':'Prepare an evacuation plan and contacts of the nearest international-standard clinic.');
    if(hasResp) L.push(ru?'Респираторные инфекции в обороте — маски на совещаниях/транспорте, тест при симптомах.':'Respiratory infections circulating — masks in meetings/transit, test if symptomatic.');
    L.push(ru?'Заложите резерв в график на случай карантинных ограничений.':'Build schedule buffer for possible quarantine measures.');
  } else if(purpose==='relocation'){
    L.push(ru?'Оцените устойчивость местной системы здравоохранения и доступ к мед.помощи.':'Assess local healthcare system resilience and access to care.');
    L.push(ru?'Изучите тренд угроз за период (вкладка «История») — направление важнее моментального снимка.':'Review the multi-period threat trend (History tab) — direction matters more than a snapshot.');
    if(hasVec||hasGI) L.push(ru?'Эндемичные инфекции — спланируйте вакцинацию всей семьи и профилактику.':'Endemic infections — plan family vaccination and prophylaxis.');
    L.push(ru?'Уточните покрытие международной медицинской страховки в регионе.':'Confirm international health-insurance coverage for the region.');
  } else { // family
    L.push(ru?'Дети и пожилые — в группе повышенного риска; обновите календарь прививок.':'Children and elderly are higher-risk; update the vaccination schedule.');
    if(hasResp) L.push(ru?'Респираторные вспышки — ограничьте посещение людных мест с детьми.':'Respiratory outbreaks — limit crowded places with children.');
    if(hasGI)  L.push(ru?'Строгая гигиена рук и контроль воды/еды для детей.':'Strict hand hygiene and water/food control for children.');
    L.push(ru?'Соберите аптечку: жаропонижающее, регидратация, средства от насекомых.':'Pack a kit: antipyretics, rehydration salts, insect protection.');
  }
  return L;
}

/* Keyword → RU localiser for live disease names (WHO DON etc. are EN). */
const _RU_DIS = [
  [/meningitis|meningococ/i,'Менингит'], [/covid|sars-cov-2/i,'COVID-19'],
  [/mers|middle east respiratory/i,'MERS (ближневост. синдром)'],
  [/ebola/i,'Эбола'], [/marburg/i,'Марбург'], [/nipah/i,'Вирус Нипах'],
  [/lassa/i,'Лихорадка Ласса'], [/cholera/i,'Холера'], [/measles/i,'Корь'],
  [/\bmpox|monkeypox/i,'Оспа обезьян'], [/dengue/i,'Денге'],
  [/chikungunya/i,'Чикунгунья'], [/zika/i,'Зика'],
  [/yellow fever/i,'Жёлтая лихорадка'], [/polio/i,'Полиомиелит'],
  [/diphther/i,'Дифтерия'], [/avian influenza|bird flu|h5n1|h7n9/i,'Птичий грипп'],
  [/influenza|\bflu\b/i,'Грипп'], [/hepatitis\s*a/i,'Гепатит A'],
  [/hepatitis\s*e/i,'Гепатит E'], [/hepatitis/i,'Гепатит'],
  [/rift valley/i,'Лихорадка долины Рифт'], [/anthrax/i,'Сибирская язва'],
  [/plague/i,'Чума'], [/oropouche/i,'Оропуш'], [/typhoid/i,'Брюшной тиф'],
  [/rabies/i,'Бешенство'], [/malaria/i,'Малярия'], [/tubercul/i,'Туберкулёз'],
  [/yellow|жёлт/i,'Жёлтая лихорадка'], [/cronobacter/i,'Кронобактер'],
  [/listeria/i,'Листерия'], [/salmonell/i,'Сальмонелла'],
  [/food insecurity|food crisis/i,'Дефицит еды'],
];
function disRu(name){
  if(LANG!=='ru' || !name) return name;
  const m = DISEASE_RU[name]; if(m) return m;
  for(const [re,ru] of _RU_DIS) if(re.test(name)) return ru;
  return name;
}

/* Recommended vaccines from active diseases + travel baseline. */
function _vaccineList(obs){
  const txt = obs.map(o=>`${o.name||''} ${o.name_ru||''} ${o.disease||''}`).join(' ').toLowerCase();
  const V = [
    [/cholera|холер/,            {ru:'Холера',                 en:'Cholera'}],
    [/yellow fever|жёлтая лихор/,{ru:'Жёлтая лихорадка (часто обязательна)', en:'Yellow fever (often mandatory)'}],
    [/mening/,                   {ru:'Менингококковая (ACWY)', en:'Meningococcal (ACWY)'}],
    [/measles|корь/,             {ru:'Корь-паротит-краснуха (MMR)', en:'Measles (MMR)'}],
    [/polio|полиомиел/,          {ru:'Полиомиелит (ревакцинация)', en:'Polio (booster)'}],
    [/rabies|бешенств/,          {ru:'Бешенство',              en:'Rabies'}],
    [/japanese enceph/,          {ru:'Японский энцефалит',     en:'Japanese encephalitis'}],
    [/covid/,                    {ru:'COVID-19 (ревакцинация)',en:'COVID-19 (booster)'}],
    [/influenza|грипп|avian/,    {ru:'Грипп',                  en:'Influenza'}],
    [/mpox|monkeypox|оспа обезь/,{ru:'Оспа (Mpox) — для групп риска', en:'Mpox — for at-risk groups'}],
  ];
  const out = [];
  for(const [re,v] of V) if(re.test(txt)) out.push(v);
  // Baseline travel vaccines (always sensible)
  out.push({ru:'Гепатит A',en:'Hepatitis A'});
  out.push({ru:'Брюшной тиф',en:'Typhoid'});
  out.push({ru:'Дифтерия-столбняк (Td, ревакцинация)',en:'Tetanus-diphtheria (Td booster)'});
  // de-dup by ru
  const seen=new Set();
  return out.filter(v=> !seen.has(v.ru) && seen.add(v.ru));
}

async function _reportAir(country){
  const c = findCountry ? findCountry(country) : null;
  const meta = c || (typeof COUNTRY_COORDS!=='undefined' ? COUNTRY_COORDS[(country||'').toLowerCase()] : null);
  const lat = meta?.lat, lon = meta?.lng ?? meta?.lon;
  if(typeof lat!=='number' || typeof lon!=='number') return null;
  try{
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`, {signal:AbortSignal.timeout(6000)});
    const j = await r.json();
    const a = j?.current?.us_aqi;
    return typeof a==='number' ? Math.round(a) : null;
  }catch{ return null; }
}

let _riskUsed = +(localStorage.getItem('vigilo_risk_used')||0);

function openRiskReport(country){
  const ru = LANG==='ru';
  // Gate: Pro unlimited; free → 1 trial then waitlist
  if(!isPaid() && _riskUsed >= 1){
    openProWaitlist('assess_risk');
    return;
  }
  let ov = document.getElementById('_riskOv');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = '_riskOv';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(8,7,6,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';
  ov.innerHTML = `<div id="_riskCard" style="background:var(--bg-card);max-width:560px;width:100%;border-radius:20px;padding:26px;box-shadow:0 30px 70px -20px rgba(0,0,0,.4);max-height:92vh;overflow:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#E8590C">${ru?'Оценка рисков':'Risk assessment'}</span>
      <button id="_riskX" style="border:0;background:none;cursor:pointer;color:var(--muted);font-size:22px;line-height:1">×</button>
    </div>
    <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px">${countryName(country)}</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:18px">${ru?'Выберите цель — соберём детальный отчёт':'Pick a purpose — we’ll build a detailed report'}</div>
    <div id="_riskPick" style="display:flex;flex-direction:column;gap:9px">
      ${RISK_PURPOSES.map(p=>`<button class="_rp" data-p="${p.id}" style="display:flex;align-items:center;gap:12px;padding:15px 16px;border:1.5px solid var(--line);border-radius:14px;background:var(--bg-card);cursor:pointer;font:inherit;font-size:14.5px;font-weight:600;color:var(--ink);text-align:left;width:100%"><span style="color:#E8590C;display:flex;flex-shrink:0">${p.icon}</span>${ru?p.ru:p.en}</button>`).join('')}
    </div>
    <div id="_riskBody"></div>
  </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  ov.querySelector('#_riskX').onclick=close;
  ov.querySelectorAll('._rp').forEach(b=>{
    b.onclick=async()=>{
      const purpose=b.dataset.p;
      if(!isPaid()){ _riskUsed++; localStorage.setItem('vigilo_risk_used',_riskUsed); }
      if(window.ym) ym(109240834,'reachGoal','risk_report',{purpose});
      ov.querySelector('#_riskPick').style.display='none';
      const body=ov.querySelector('#_riskBody');
      body.innerHTML=`<div style="padding:30px 0;text-align:center;color:var(--muted);font-size:13px">${ru?'Собираем отчёт…':'Building report…'}</div>`;
      body.innerHTML = await buildRiskReport(country, purpose);
      const pr=document.getElementById('_riskPrint');
      if(pr) pr.onclick=()=>window.print();
    };
  });
}

async function buildRiskReport(country, purpose){
  const ru = LANG==='ru';
  const obs = OUTBREAKS.filter(o=> o.country===country);
  const recalls = (typeof FOOD_RECALLS!=='undefined'?FOOD_RECALLS:[]).filter(r=>{
    const c = findCountry ? findCountry(country) : null;
    return c && (r.iso===c.iso2);
  });
  const v = _riskVerdict(country, obs);
  const pObj = RISK_PURPOSES.find(p=>p.id===purpose) || RISK_PURPOSES[0];
  const air = await _reportAir(country);
  const hs = (typeof historySeries==='function') ? historySeries(country) : null;
  const rs = _riskScore({ obs, country, air, recalls, hs });
  let trendTxt='';
  if(hs && hs.total.length>1){
    const d = (hs.total[hs.total.length-1]||0) - (hs.total[0]||0);
    trendTxt = d>0 ? (ru?`растёт (+${d} за ${hs.dates.length} дн.)`:`rising (+${d} over ${hs.dates.length}d)`)
            : d<0 ? (ru?`снижается (${d})`:`falling (${d})`)
            : (ru?'стабилен':'stable');
  }
  const adv = (TRAVEL_ADVISORY[LANG]||TRAVEL_ADVISORY.en)[countryRiskTier(country)];
  const threats = obs.length
    ? obs.sort((a,b)=>(SEV[b.sev]?.idx??0)-(SEV[a.sev]?.idx??0)).map(o=>{
        const s=SEV[o.sev]; const sum=(LANG==='ru'&&o.blurb_ru)?o.blurb_ru:(o.blurb||o.summary||'');
        return `<div style="padding:10px 0;border-bottom:1px solid #F2F0E8">
          <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:13.5px">${disRu(diseaseName(o))}</b><span style="font-size:11px;font-weight:700;color:${s.color}">${s.label}</span></div>
          ${sum?`<div style="font-size:12px;color:var(--ink-2);line-height:1.5;margin-top:3px">${sum}</div>`:''}
        </div>`;}).join('')
    : `<div style="font-size:12.5px;color:var(--muted);padding:8px 0">${ru?'Активных вспышек по официальным источникам нет.':'No active outbreaks per official sources.'}</div>`;
  const guidance = _purposeGuidance(purpose, country, obs)
    .map(g=>`<li style="font-size:12.5px;color:var(--ink-2);line-height:1.55;margin:5px 0">${g}</li>`).join('');
  const vaxHtml = _vaccineList(obs).map(v=>
    `<div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #F2F0E8">
       <span style="color:#19A463;display:flex;flex-shrink:0"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
       <span style="font-size:13px;color:var(--ink);font-weight:600">${ru?v.ru:v.en}</span>
     </div>`).join('');
  const airTxt = air==null ? (ru?'нет данных':'no data')
    : air<=50?(ru?`хорошее (${air})`:`good (${air})`)
    : air<=100?(ru?`умеренное (${air})`:`moderate (${air})`)
    : air<=150?(ru?`вредно для чувств. (${air})`:`unhealthy-sensitive (${air})`)
    : air<=200?(ru?`вредное (${air})`:`unhealthy (${air})`)
    :(ru?`опасное (${air})`:`hazardous (${air})`);

  // ── Emergency services ──────────────────────────────────────
  const _cc   = findCountry ? findCountry(country) : null;
  const iso2  = _cc?.iso2;
  const em    = emergencyFor(iso2);
  const callBtn = (label, num, svg) => `<a href="tel:${num}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;background:var(--bg-card);border:1px solid var(--line);border-radius:12px;text-decoration:none">
      <span style="color:#C92A2A;display:flex"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>
      <span style="font-size:18px;font-weight:800;color:var(--ink);letter-spacing:-.02em">${num}</span>
      <span style="font-size:10px;color:var(--muted)">${label}</span></a>`;
  const emHtml = em.g
    ? `<a href="tel:${em.g}" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;background:#C92A2A;border-radius:14px;text-decoration:none">
         <span style="color:#fff;display:flex"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.74a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/></svg></span>
         <span style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-.02em">${em.g}</span>
         <span style="font-size:11px;color:rgba(255,255,255,.85)">${ru?'единый номер':'universal'}</span></a>`
    : `<div style="display:flex;gap:8px">
         ${callBtn(ru?'Полиция':'Police', em.p, '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z"/>')}
         ${callBtn(ru?'Скорая':'Ambulance', em.a, '<path d="M3 12h18M12 3v18"/><circle cx="12" cy="12" r="9"/>')}
         ${callBtn(ru?'Пожарные':'Fire', em.f, '<path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-5 3 2 4 5 4 8a6 6 0 0 1-12 0c0-5 4-7 6-12z"/>')}
       </div>`;

  // ── Useful links ────────────────────────────────────────────
  const cn = countryName(country);
  const links = [
    { t: ru?'Больницы рядом (карта)':'Hospitals nearby (map)',
      u: `https://www.google.com/maps/search/${encodeURIComponent((ru?'больница ':'hospital ')+country)}` },
    { t: ru?'WHO — профиль страны':'WHO — country profile',
      u: `https://www.who.int/countries/` },
    { t: ru?'Найти своё посольство':'Find your embassy',
      u: `https://www.google.com/search?q=${encodeURIComponent('embassy in '+country)}` },
  ];
  const linksHtml = links.map(l=>`<a href="${l.u}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;background:var(--bg-card);border:1px solid var(--line);border-radius:11px;text-decoration:none;margin-bottom:6px">
      <span style="font-size:12.5px;font-weight:600;color:var(--ink)">${l.t}</span>
      <span style="color:var(--muted);display:flex"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span></a>`).join('');

  const chip = (label, val, color) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${color}14;color:${color};font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px">${label}: ${val}</span>`;

  const trendClr = /рас|ris/i.test(trendTxt) ? '#C92A2A' : /сниж|fall/i.test(trendTxt) ? '#3D8B5C' : '#807E76';
  const aqiClr = air==null?'#807E76':air<=50?'#19A463':air<=100?'#E4B514':air<=150?'#E8590C':'#C92A2A';

  return `
  <div id="_riskReport" style="margin-top:4px">
    <div style="background:linear-gradient(160deg,${v.color}1f,${v.color}0a);border:1px solid ${v.color}40;border-radius:18px;padding:18px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:11px">
        <span style="width:42px;height:42px;border-radius:12px;background:${v.color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v5c0 5 3.8 8.9 9 10 5.2-1.1 9-5 9-10V7z"/></svg>
        </span>
        <div>
          <div style="font-size:18px;font-weight:900;color:${v.color};letter-spacing:-.02em">${v.label}</div>
          <div style="font-size:12px;color:var(--ink-2);margin-top:1px">${ru?pObj.ru:pObj.en} · ${cn} · ${new Date().toLocaleDateString(LANG)}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
        ${chip(ru?'Поездки':'Travel', `<b>${adv?.label||'—'}</b>`, v.color)}
        ${trendTxt?chip(ru?'Тренд':'Trend', trendTxt, trendClr):''}
        ${chip(ru?'Воздух':'Air', airTxt, aqiClr)}
        ${recalls.length?chip(ru?'Отзывы':'Recalls', recalls.length, '#E8590C'):''}
      </div>
    </div>

    ${_sec(ru?'Индекс риска':'Risk index','<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>')}
    <div style="background:var(--bg-card);border:1px solid var(--line);border-radius:16px;padding:16px 16px 18px">
      ${_riskGauge(rs.score, rs.band.c, ru?rs.band.ru:rs.band.en)}
      <div style="text-align:center;font-size:11.5px;color:var(--muted);margin:2px 0 12px">${ru?'Композитный индекс 0–100 — сводная оценка по всем сигналам':'Composite index 0–100 — overall score from all signals'}</div>

      <!-- Gradation scale -->
      <div style="display:flex;height:8px;border-radius:99px;overflow:hidden;margin-bottom:6px">
        <span style="flex:25;background:#19A463"></span><span style="flex:25;background:#E4B514"></span><span style="flex:25;background:#E8590C"></span><span style="flex:25;background:#C92A2A"></span>
      </div>
      <div style="display:flex;font-size:10px;color:var(--muted);margin-bottom:16px">
        <span style="flex:25">${ru?'0–24 Низкий':'0–24 Low'}</span>
        <span style="flex:25">${ru?'25–49 Умер.':'25–49 Mod.'}</span>
        <span style="flex:25">${ru?'50–74 Высокий':'50–74 High'}</span>
        <span style="flex:25;text-align:right">${ru?'75–100 Серьёзный':'75–100 Severe'}</span>
      </div>

      ${rs.parts.map(p=>{
        const pct = Math.max(0, Math.min(100, (p.v/p.max)*100));
        return `<div style="margin:9px 0">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:118px;font-size:12px;font-weight:600;color:var(--ink);flex-shrink:0">${p.l}${p.note?` <span style="color:var(--muted);font-weight:400">· ${p.note}</span>`:''}</span>
            <span style="flex:1;height:7px;background:var(--line-2);border-radius:99px;overflow:hidden"><span style="display:block;height:100%;width:${pct.toFixed(0)}%;background:${p.c};border-radius:99px"></span></span>
            <span style="width:42px;text-align:right;font-size:12.5px;font-weight:800;color:${p.c};font-variant-numeric:tabular-nums">${Math.round(pct)}%</span>
          </div>
          <div style="font-size:10.5px;color:var(--muted);margin:3px 0 0 0;line-height:1.4">${p.desc||''}</div>
        </div>`;
      }).join('')}
      <div style="font-size:10px;color:var(--muted-2);margin-top:14px;line-height:1.5;border-top:1px dashed var(--line);padding-top:10px">
        ${ru?'Чем выше индекс — тем больше совокупный риск. Покрытие источников по ряду стран ограничено.':'Higher index = higher overall risk. Source coverage is limited for some countries.'}
      </div>
    </div>

    ${_sec(ru?'Экстренные службы':'Emergency services','<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.74a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/>')}
    ${emHtml}
    <div style="font-size:10.5px;color:var(--muted-2);margin-top:7px">${ru?'Не дозвонились — наберите 112 (международный, работает в большинстве стран).':'No answer — dial 112 (international, works in most countries).'}</div>

    ${_sec(ru?'Активные угрозы':'Active threats','<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>')}
    ${threats}

    ${_sec(ru?`Рекомендации · ${pObj.ru}`:`Recommendations · ${pObj.en}`,'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}
    <ul style="margin:0;padding-left:18px">${guidance}</ul>

    ${_sec(ru?'Рекомендуемые прививки':'Recommended vaccines','<path d="m18 2 4 4-8 8-4-4z"/><path d="m9 7-5 5a3 3 0 0 0 4 4l5-5"/><path d="M3 21l3-3"/>')}
    <div style="background:var(--bg-card);border:1px solid var(--line);border-radius:14px;padding:6px 14px 12px">
      ${vaxHtml}
      <div style="font-size:10.5px;color:var(--muted-2);margin-top:10px;line-height:1.5">${ru?'Список ориентировочный (по активным болезням + базовый набор для поездок). Точную схему уточните у врача-инфекциониста.':'Indicative list (active diseases + travel baseline). Confirm the exact schedule with a travel-medicine doctor.'}</div>
    </div>

    ${_sec(ru?'Полезные ссылки':'Useful links','<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>')}
    ${linksHtml}

    <div style="font-size:10px;color:var(--muted-2);margin-top:18px;line-height:1.5">
      ${ru?'Отчёт сформирован по данным WHO/CDC/ECDC/GDACS/Open-Meteo. Не является медицинской консультацией. Источники могут быть неполными по ряду стран. Номера служб уточняйте на месте.':'Generated from WHO/CDC/ECDC/GDACS/Open-Meteo data. Not medical advice. Source coverage is limited for some countries; verify emergency numbers locally.'}
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button id="_riskPrint" style="flex:1;height:46px;border:0;border-radius:13px;background:var(--ink);color:var(--bg-card);font:inherit;font-size:14px;font-weight:800;cursor:pointer">${ru?'Скачать / Печать (PDF)':'Download / Print (PDF)'}</button>
    </div>
  </div>`;
}

const ACCOUNT_URL = (window.EPISWOPE_LANG === 'ru') ? '/ru/account.html' : '/account.html';

function updateUserBtn() {
  const btn = document.getElementById('userBtn');
  if (!btn) return;
  const s = getSession();
  const paid = isPaid();
  // remove any previous Pro badge
  const old = btn.querySelector('._proBadge');
  if (old) old.remove();
  if (s) {
    btn.style.color = 'var(--accent)';
    btn.title = s.email + (paid ? ' · Pro' : ' · Free');
    if (paid) {
      btn.style.position = 'relative';
      const b = document.createElement('span');
      b.className = '_proBadge';
      b.textContent = '✦';
      b.style.cssText = 'position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:linear-gradient(180deg,#F5A623,#E8930C);color:#fff;font-size:8px;line-height:14px;text-align:center;font-weight:800;box-shadow:0 0 0 2px var(--bg-card)';
      btn.appendChild(b);
    }
  } else {
    btn.style.color = '';
    btn.title = LANG === 'ru' ? 'Войти' : 'Sign in';
  }
  // Hide the header "Pro" upgrade pill for paying users — nothing to upsell
  document.querySelectorAll('.pro-pill').forEach(p => {
    p.style.display = paid ? 'none' : '';
  });
}

function toggleAuthPopover() {
  let pop = document.getElementById('_authPop');
  if (pop && pop.style.display !== 'none') { pop.style.display = 'none'; return; }
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_authPop';
    pop.style.cssText = 'position:absolute;top:52px;right:0;background:var(--bg-card);border:1px solid var(--line);border-radius:12px;padding:16px;width:260px;box-shadow:0 8px 24px rgba(0,0,0,.10);z-index:1000;font-size:13px;';
    document.querySelector('.top-actions').style.position = 'relative';
    document.querySelector('.top-actions').appendChild(pop);
  }
  const s = getSession();
  if (s) {
    const isPro = isPaid();
    pop.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${s.email}</div>
      <div style="color:${isPro?'#F5A623':'#807E76'};font-size:12px;margin-bottom:14px">${isPro ? '✦ Pro' : (LANG==='ru'?'Бесплатный план':'Free plan')}</div>
      <a href="${ACCOUNT_URL}" style="display:block;text-align:center;width:100%;padding:9px;background:var(--ink);color:var(--bg-card);border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:8px">${LANG==='ru'?'Мой профиль':'My profile'}</a>
      ${isPro ? '' : `<a href="${ACCOUNT_URL}" style="display:block;text-align:center;width:100%;padding:9px;background:linear-gradient(180deg,#E8590C,#C92A2A);color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;margin-bottom:8px">${LANG==='ru'?'✦ Перейти на Pro':'✦ Upgrade to Pro'}</a>`}
      <button onclick="localStorage.removeItem('vigilo_jwt');location.reload()" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg-card);cursor:pointer;font-size:13px">${LANG==='ru'?'Выйти':'Sign out'}</button>`;
  } else {
    const hint = LANG === 'ru' ? 'Введи email — пришлём ссылку для входа.' : 'Enter your email — we\'ll send a login link.';
    const placeholder = LANG === 'ru' ? 'твой@email.com' : 'your@email.com';
    const btnTxt = LANG === 'ru' ? 'Отправить ссылку' : 'Send login link';
    const sentTxt = LANG === 'ru' ? 'Проверь почту ✓' : 'Check your email ✓';
    pop.innerHTML = `
      <p style="margin:0 0 10px;color:var(--ink-2)">${hint}</p>
      <input id="_authEmail" type="email" placeholder="${placeholder}" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;margin-bottom:8px">
      <button id="_authSend" onclick="sendMagicLink()" style="width:100%;padding:8px;background:var(--ink);color:var(--bg-card);border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">${btnTxt}</button>
      <div id="_authMsg" style="margin-top:8px;font-size:12px;color:var(--muted);min-height:16px"></div>`;
    pop._sentTxt = sentTxt;
  }
  pop.style.display = 'block';
  setTimeout(() => {
    const handler = (e) => {
      if (!pop.contains(e.target) && e.target.id !== 'userBtn') {
        pop.style.display = 'none';
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);
}

async function sendMagicLink() {
  const input = document.getElementById('_authEmail');
  const msgEl = document.getElementById('_authMsg');
  const btn   = document.getElementById('_authSend');
  const pop   = document.getElementById('_authPop');
  if (!input || !input.value.includes('@')) return;
  btn.disabled = true;
  btn.style.opacity = '.6';
  try {
    await fetch('/api/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.value.trim(), lang: LANG }),
    });
    msgEl.textContent = pop._sentTxt || 'Check your email ✓';
    msgEl.style.color = '#2D9B6A';
    input.disabled = true;
    btn.style.display = 'none';
  } catch {
    msgEl.textContent = 'Error. Try again.';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

/** Render the "My countries" sidebar section from the WATCHED Set.
 *  Empty state explains how to add countries. Each row clicks to the
 *  country profile; trailing × removes from the watch list. */
const MC_BAND_C = { minimal:'#9aa0a6', low:'#E4B514', moderate:'#E8590C', elevated:'#d8531e', severe:'#C92A2A', critical:'#8B1A1A' };
let _mcSeen = null;   // last-visit snapshot {iso2: score}, frozen for the session

/* Composite score+band for a watched country name (via RISK_INDEX, ISO2 key). */
function mcRisk(name){
  const meta = findCountry(name);
  const iso2 = (meta && meta.iso2 || '').toUpperCase();
  const ri = iso2 ? RISK_INDEX[iso2] : null;
  const cr = ri && ri.composite_risk;
  return { iso2, score: cr && typeof cr.score==='number' ? cr.score : null, band: cr && cr.band || null };
}

function renderMyCountries(){
  const root = document.getElementById('myCountries');
  const count = document.getElementById('myCountriesCount');
  if(!root) return;
  if(_mcSeen === null){ try{ _mcSeen = JSON.parse(localStorage.getItem('vigilo_seen')||'{}'); }catch(e){ _mcSeen = {}; } }

  const watched = [...WATCHED];
  if(count) count.textContent = watched.length;
  if(!watched.length){
    root.innerHTML = `<div class="mc-empty">${LANG==='ru'
      ? 'Подпишись на страну в правой панели — она появится здесь.'
      : 'Watch a country from the right panel — it lands here.'}</div>`;
    return;
  }

  // Compute current risk + delta-since-last-visit, then sort changed-first.
  const seenNow = {};
  const rows = watched.map(c => {
    const r = mcRisk(c);
    let delta = 0, isNew = false;
    if(r.score !== null){
      seenNow[r.iso2] = r.score;
      const prev = _mcSeen[r.iso2];
      if(typeof prev === 'number') delta = +(r.score - prev).toFixed(2);
      else isNew = true;
    }
    return { c, r, delta, isNew, n: OUTBREAKS.filter(o => o.country === c || (findCountry(o.country)?.en === c)).length };
  });
  rows.sort((a,b) => (Math.abs(b.delta)-Math.abs(a.delta)) || countryName(a.c).localeCompare(countryName(b.c)));
  // Persist current scores as the new "last seen" for the next session.
  try{ localStorage.setItem('vigilo_seen', JSON.stringify(Object.assign({}, _mcSeen, seenNow))); }catch(e){}

  const changed = rows.filter(x => Math.abs(x.delta) >= 0.3).length;
  const sumEl = document.getElementById('myCountriesDelta');
  if(sumEl) sumEl.textContent = changed
    ? (LANG==='ru' ? `${changed} изменилось с прошлого визита` : `${changed} changed since your last visit`)
    : (LANG==='ru' ? 'без изменений с прошлого визита' : 'no change since your last visit');

  root.innerHTML = rows.map(({c, r, delta, isNew, n}) => {
    const isSel = state.selectedCountry === c;
    const dotC = r.band ? (MC_BAND_C[r.band]||'#9aa0a6') : '#cfccc1';
    let dlt = '';
    if(isNew) dlt = `<span class="mc-delta new" title="${LANG==='ru'?'новое в списке':'new to your list'}">•</span>`;
    else if(delta >= 0.3) dlt = `<span class="mc-delta up" title="${LANG==='ru'?'риск вырос':'risk rose'} (+${delta})">▲</span>`;
    else if(delta <= -0.3) dlt = `<span class="mc-delta down" title="${LANG==='ru'?'риск снизился':'risk eased'} (${delta})">▼</span>`;
    return `<div class="mc-row${isSel ? ' is-selected' : ''}" data-country="${c.replace(/"/g,'&quot;')}">
      <span class="mc-dot" style="background:${dotC}" title="${r.band||'—'}"></span>
      <span class="nm">${countryName(c)}</span>
      ${dlt}
      <span class="cnt${n>0?' has':''}">${n>0?n:'—'}</span>
      <span class="x" data-remove="${c.replace(/"/g,'&quot;')}" title="${LANG==='ru'?'Удалить':'Remove'}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </span>
    </div>`;
  }).join('');
  root.querySelectorAll('.mc-row').forEach(el => {
    el.addEventListener('click', (e) => {
      const x = e.target.closest('[data-remove]');
      if(x){
        e.stopPropagation();
        toggleWatch(x.dataset.remove);
      } else {
        selectCountry(el.dataset.country);
      }
    });
  });
}

/* ── My Feed ─────────────────────────────────────────────── */
function renderMyFeedItems(){
  const root    = document.getElementById('myFeed');
  const countEl = document.getElementById('myFeedCount');
  if(!root) return;

  const SEV_ORD = {catastrophic:6, critical:5, alert:4, warning:3, low:2, monitoring:1};
  const ru = LANG === 'ru';

  const items = OUTBREAKS
    .filter(o => WATCHED.has(o.country))
    .map(o => ({
      type:  o.type === 'food' ? 'food' : 'outbreak',
      ord:   SEV_ORD[o.sev] || 0,
      title: diseaseName(o),
      meta:  countryName(o.country),
      color: SEV[o.sev]?.color || '#A09F95',
      id:    o.id,
    }))
    .sort((a, b) => b.ord - a.ord)
    .slice(0, 20);

  if(countEl) countEl.textContent = items.length || '0';

  const tagLbl = t => t === 'food'
    ? (ru ? 'Продукт' : 'Recall')
    : (ru ? 'Вспышка' : 'Outbreak');

  if(!items.length){
    root.innerHTML = `<div class="feed-empty">${ru ? 'Нет активных событий.' : 'No active events.'}</div>`;
    return;
  }

  root.innerHTML = items.map((item, i) => `
    <div class="feed-item" data-fi="${i}">
      <span class="feed-dot" style="background:${item.color}"></span>
      <div class="feed-body">
        <div class="feed-title">${item.title}<span class="feed-tag ${item.type}">${tagLbl(item.type)}</span></div>
        <div class="feed-meta">${item.meta}</div>
      </div>
    </div>`).join('');

  root.querySelectorAll('.feed-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = items[+el.dataset.fi];
      if(!item) return;
      if(item.id != null) selectOutbreak(item.id);
      else if(item.link) window.open(item.link, '_blank', 'noopener');
    });
  });
}

function renderMyFeed(){
  const root = document.getElementById('myFeed');
  const fil  = document.getElementById('myFeedFilter');
  if(!root) return;
  if(fil) fil.innerHTML = ''; // no filter chips

  const ru = LANG === 'ru';
  if(!WATCHED.size){
    const countEl = document.getElementById('myFeedCount');
    if(countEl) countEl.textContent = '0';
    root.innerHTML = `<div class="feed-empty">${ru
      ? 'Добавь страны в список наблюдения — здесь появится твой персональный фид.'
      : 'Watch countries from the right panel — your alerts feed appears here.'}</div>`;
    return;
  }

  renderMyFeedItems();
}

/* ── Country Profile ─────────────────────────────────────── */
function getUniqueCountries(){
  const seen = new Set();
  const list = [];
  for(const o of OUTBREAKS){
    if(o.country && !seen.has(o.country)){
      seen.add(o.country);
      list.push(o.country);
    }
  }
  return list.sort((a,b) => countryName(a).localeCompare(countryName(b)));
}

function selectCountry(country){
  state.selectedCountry = country;
  const inp = document.getElementById('countrySearch');
  if(inp) inp.value = country ? countryName(country) : '';
  const dd = document.getElementById('countryDropdown');
  if(dd) dd.style.display = 'none';
  renderList();
  if(country){
    renderCountryPanel(country);
    track('Country Open', { country: countryName(country) });
  } else renderPanel();
  renderMyCountries();
  if(country && window.innerWidth <= 768 && typeof window.mobOpenDetail === 'function') window.mobOpenDetail(true);
}

function generateRecommendation(country, outbreaks){
  const risk = countryTravelRisk(country);
  const parts = [];

  // Lead line
  const cname = countryName(country);
  if(LANG === 'ru'){
    if(risk === 'high')   parts.push(`Рекомендуем воздержаться от несущественных поездок в ${cname}.`);
    else if(risk === 'medium') parts.push(`Соблюдайте повышенную осторожность при поездках в ${cname}.`);
    else parts.push(`Стандартные меры предосторожности для поездок в ${cname}.`);
  } else {
    if(risk === 'high')   parts.push(`Avoid non-essential travel to ${country}.`);
    else if(risk === 'medium') parts.push(`Exercise increased caution when traveling to ${country}.`);
    else parts.push(`Standard precautions apply for travel to ${country}.`);
  }

  // Disease-specific advice
  const names = outbreaks.map(o=>(o.name||'').toLowerCase()).join(' ');
  const isMosquito = /dengue|malaria|yellow fever|west nile/.test(names);
  const isWater    = /cholera|typhoid|polio/.test(names);
  const isContact  = /ebola|marburg|lassa|mpox/.test(names);
  const isAirborne = /measles|meningitis|influenza|h5n1/.test(names);

  if(LANG === 'ru'){
    if(isMosquito) parts.push('Используйте репеллент и носите закрытую одежду — активны трансмиссивные заболевания.');
    if(isWater)    parts.push('Пейте только бутилированную воду, избегайте уличной еды — риск водных инфекций.');
    if(isContact)  parts.push('Избегайте контакта с больными и биологическими жидкостями — вспышка геморрагической лихорадки.');
    if(isAirborne) parts.push('Рассмотрите ношение маски в людных местах — активны воздушно-капельные инфекции.');
  } else {
    if(isMosquito) parts.push('Use insect repellent and wear protective clothing — vector-borne diseases active.');
    if(isWater)    parts.push('Drink only bottled or boiled water, avoid street food — waterborne disease risk.');
    if(isContact)  parts.push('Avoid contact with sick individuals and body fluids — hemorrhagic fever outbreak.');
    if(isAirborne) parts.push('Consider wearing a mask in crowded areas — airborne infections active.');
  }

  return parts.join(' ');
}

function renderCountryPanel(country){
  // ── Data collection ──────────────────────────────
  const outbreaks     = OUTBREAKS.filter(o => o.country === country);
  const epidemics     = outbreaks.filter(o => !o.type || o.type === 'epidemic');
  const airEvents     = outbreaks.filter(o => o.type === 'air');
  const disasters     = outbreaks.filter(o => o.type === 'disaster');
  const humanitarians = outbreaks.filter(o => o.type === 'humanitarian');

  const totalCases  = epidemics.reduce((s,o) => s + (o.cases  || 0), 0);
  const totalDeaths = epidemics.reduce((s,o) => s + (o.deaths || 0), 0);

  const iso2     = findCountry(country)?.iso2;
  const riskData = iso2 ? RISK_INDEX[iso2] : null;

  const risk  = countryTravelRisk(country);
  const adv   = TRAVEL_ADVISORY[LANG]?.[risk] || TRAVEL_ADVISORY.en[risk];
  const rec   = generateRecommendation(country, outbreaks);
  const cname = countryName(country);

  let domSev = 'monitoring';
  if(epidemics.length){
    domSev = epidemics.reduce((m,o) => (SEV[o.sev]?.idx ?? 0) > (SEV[m.sev]?.idx ?? 0) ? o : m).sev;
  }
  const sev = SEV[domSev];
  const ru  = LANG === 'ru';

  // AQI from air-type outbreaks
  const aqiEvent = airEvents[0];
  let aqiVal = null;
  if(aqiEvent){
    const m = (aqiEvent.blurb || aqiEvent.summary || '').match(/AQI\s*(\d+)/i);
    if(m) aqiVal = parseInt(m[1]);
  }

  // Food recalls for country
  const foodForCountry = FOOD_RECALLS.filter(r =>
    (iso2 && r.iso === iso2) || r.country === country
  );

  // ── History tab (existing logic) ──────────────────
  const LOW_COV = new Set(['Russia','China','Belarus','Turkmenistan','North Korea','Tajikistan','Uzbekistan','Kyrgyzstan']);
  const provNote = (ru
    ? 'Данные: WHO/ECDC/GDACS и др. Отсутствие событий ≠ «всё спокойно».'
    : 'Data: WHO/ECDC/GDACS et al. Absence of events is not an all-clear.')
    + (LOW_COV.has(country) ? (ru
      ? ' Независимый надзор ограничен — данные из межд. отчётов WHO.'
      : ' Independent surveillance is limited — based on WHO international reports.') : '');

  const hs = historySeries(country);
  let histBody;
  if(!hs || hs.dates.length < 1){
    histBody = `<div class="cp-hist-empty">${ru ? 'История накапливается — загляните позже.' : 'History is accumulating — check back soon.'}</div>`;
  } else {
    const cur   = hs.total[hs.total.length - 1] || 0;
    const peak  = Math.max(...hs.total);
    const delta = cur - (hs.total[0] || 0);
    const trendClr = delta > 0 ? 'var(--s3)' : delta < 0 ? '#3D8B5C' : 'var(--muted)';

    // Narrative — one sentence that explains what you're looking at
    const situationWord = delta > 0
      ? (ru ? 'ухудшается' : 'worsening')
      : delta < 0 ? (ru ? 'улучшается' : 'improving')
      : (ru ? 'стабильна' : 'stable');
    const narrative = cur === 0
      ? (ru
          ? `За последние ${hs.dates.length} дней активных угроз не зафиксировано.`
          : `No active threats recorded in the last ${hs.dates.length} days.`)
      : (ru
          ? `За ${hs.dates.length} дней наблюдается <b>${cur}</b> ${cur === 1 ? 'активная угроза' : 'активных угрозы'}. Ситуация <span style="color:${trendClr}">${situationWord}</span>.`
          : `Over ${hs.dates.length} days — <b>${cur}</b> active ${cur === 1 ? 'threat' : 'threats'}. Situation <span style="color:${trendClr}">${situationWord}</span>.`);

    // Date labels
    const fmt = d => { const p = d.split('-'); return p[2] + '.' + p[1]; };
    const dateFrom = fmt(hs.dates[0]);
    const dateTo   = fmt(hs.dates[hs.dates.length - 1]);

    // Current threats list (from live OUTBREAKS for this country)
    const eventsHtml = outbreaks.length
      ? outbreaks.map(o => {
          const s = SEV[o.sev];
          const dateMatch = (o.code || '').match(/(\d{4}-\d{2}-\d{2})/);
          const dStr = dateMatch ? fmt(dateMatch[1]) : '';
          const blurb = (ru ? o.blurb_ru : o.blurb) || '';
          return `<div class="cp-hist-ev">
            <span class="cp-hist-ev-dot" style="background:${s.color}"></span>
            <div class="cp-hist-ev-body">
              <div class="cp-hist-ev-name">${diseaseName(o.name)}
                <span class="cp-hist-ev-sev" style="color:${s.color}">${s.label}</span>
              </div>
              ${blurb ? `<div class="cp-hist-ev-txt">${blurb.slice(0,110)}${blurb.length>110?'…':''}</div>` : ''}
              ${dStr ? `<div class="cp-hist-ev-date">${ru?'обнаружено':'detected'} ${dStr}</div>` : ''}
            </div>
          </div>`;
        }).join('')
      : `<div class="cp-hist-empty" style="padding:8px 0">${ru?'Нет активных угроз.':'No active threats.'}</div>`;

    histBody = `
      <div class="cp-hist-narrative">${narrative}</div>
      <div class="cp-hist-chart-wrap">
        <div class="cp-hist-chart">${renderHistoryChart(hs, sev.color)}</div>
        <div class="cp-hist-xlabels"><span>${dateFrom}</span><span>${dateTo}</span></div>
        <div class="cp-hist-ylabel">${ru?'угрозы':'threats'}</div>
      </div>
      ${peak > 0 ? `<div class="cp-hist-stats" style="grid-template-columns:repeat(3,1fr)">
        <div><div class="v">${peak}</div><div class="k">${ru?'макс. одноврем.':'peak active'}</div></div>
        <div><div class="v">${cur}</div><div class="k">${ru?'активно сейчас':'active now'}</div></div>
        <div><div class="v" style="color:${trendClr}">${delta > 0 ? '+' : ''}${delta}</div><div class="k">${ru?'динамика':'change'}</div></div>
      </div>` : ''}
      <div class="cp-hist-ev-title">${ru?'Текущие угрозы':'Current threats'}</div>
      <div class="cp-hist-evlist">${eventsHtml}</div>
      <div class="cp-hist-note">${ru?'Период':'Period'}: ${hs.dates[0]} → ${hs.dates[hs.dates.length-1]}</div>`;
  }

  // ── Tab 1: Overview ───────────────────────────────
  const threatsHtml = epidemics.length
    ? epidemics.map(o => {
        const s = SEV[o.sev];
        return `<div class="cp-threat-row">
          <span class="cp-threat-dot" style="background:${s.color}"></span>
          <div class="cp-threat-info">
            <span class="cp-threat-name">${diseaseName(o.name)}</span>
            <span class="cp-threat-sev" style="color:${s.color}">${s.label}</span>
          </div>
          <div class="cp-threat-num">${fmtNum(o.cases||0)}<small>${ru?'сл.':'cases'}</small></div>
        </div>`;
      }).join('')
    : `<div class="cp-no-threats">${ru ? 'Активных вспышек не зарегистрировано.' : 'No active outbreaks reported.'}</div>`;

  const overviewHtml = `
    <div class="cp-stats-row">
      <div class="cp-stat"><div class="cp-stat-val">${fmtNum(totalCases)}</div><div class="cp-stat-lbl">${ru?'Случаев':'Cases'}</div></div>
      <div class="cp-stat"><div class="cp-stat-val" style="color:${sev.color}">${fmtNum(totalDeaths)}</div><div class="cp-stat-lbl">${ru?'Смертей':'Deaths'}</div></div>
      <div class="cp-stat"><div class="cp-stat-val">${epidemics.length + disasters.length}</div><div class="cp-stat-lbl">${ru?'Угрозы':'Threats'}</div></div>
    </div>
    <div class="cp-section">
      <div class="cp-section-title">${ru?'Активные угрозы':'Active threats'}</div>
      ${threatsHtml}
      <div class="cp-prov">${provNote}</div>
    </div>
    <div class="cp-section">
      <div class="cp-section-title">${ru?'Рекомендация':'Recommendation'}</div>
      <div class="cp-rec-text">${rec}</div>
    </div>
    <div class="cp-section">
      <button class="cp-assess-btn" id="cpAssessBtn" data-country="${escapeAttr(country)}">${ru?'Оценить риски →':'Assess risks →'}</button>
      <div id="assessCounter" style="text-align:center;font-size:10.5px;margin-top:4px;color:var(--muted);"></div>
    </div>
    <div class="cp-section">
      <form class="cp-subscribe" data-country="${escapeAttr(country)}" data-lang="${LANG}">
        <label class="cp-sub-label">${ru ? 'Спокойный недельный digest на email' : 'Calm weekly digest by email'}</label>
        <div class="cp-sub-row">
          <input type="email" class="cp-sub-input" name="email" required placeholder="${ru ? 'твой email' : 'your email'}" autocomplete="email">
          <button type="submit" class="cp-sub-btn">${ru ? 'Следить' : 'Watch'}</button>
        </div>
        <div class="cp-sub-status" aria-live="polite"></div>
      </form>
    </div>`;

  // ── Tab 2: Health ─────────────────────────────────
  const AQI_CATS_LOCAL = [
    {max:50,  label:ru?'Хороший':'Good',                    color:'#19A463'},
    {max:100, label:ru?'Умеренный':'Moderate',              color:'#E4B514'},
    {max:150, label:ru?'Вреден для чувствит.':'Unhealthy for Sensitive', color:'#E8590C'},
    {max:200, label:ru?'Вредный':'Unhealthy',               color:'#C92A2A'},
    {max:300, label:ru?'Очень вредный':'Very Unhealthy',    color:'#8B1A1A'},
    {max:500, label:ru?'Опасный':'Hazardous',               color:'#5C2010'},
  ];
  const aqiCat = aqiVal != null
    ? (AQI_CATS_LOCAL.find(c => aqiVal <= c.max) || AQI_CATS_LOCAL[AQI_CATS_LOCAL.length-1])
    : null;

  const aqiHtml = (aqiEvent && aqiVal != null) ? `
    <div class="cp-aqi">
      <div class="cp-aqi-val" style="color:${aqiCat.color}">${aqiVal}</div>
      <div class="cp-aqi-info">
        <div class="cp-aqi-cat" style="color:${aqiCat.color}">${aqiCat.label}</div>
        <div class="cp-aqi-lbl">PM2.5 · ${ru?'Индекс качества воздуха':'Air Quality Index'}</div>
        <div class="cp-aqi-src">${aqiEvent.who || 'Open-Meteo AQI'}</div>
      </div>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${aqiCat.color}" stroke-width="1.8" stroke-linecap="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M17.73 2.27A2.5 2.5 0 1 1 19.5 6.5H2"/><path d="M14.5 15.5A2.5 2.5 0 1 0 16.5 19H2"/></svg>
    </div>` : `
    <div class="cp-aqi cp-aqi-none">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" stroke-width="1.8" stroke-linecap="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M17.73 2.27A2.5 2.5 0 1 1 19.5 6.5H2"/><path d="M14.5 15.5A2.5 2.5 0 1 0 16.5 19H2"/></svg>
      <div class="cp-aqi-info"><div class="cp-aqi-src">${ru?'Нет данных о качестве воздуха для этой страны':'No air quality data for this country'}</div></div>
    </div>`;

  const diseaseListHtml = epidemics.length
    ? `<div class="cp-health-list">` + epidemics.map(o => {
        const s = SEV[o.sev];
        const blurb = (LANG === 'ru' ? o.blurb_ru : o.blurb) || '';
        return `<div class="cp-health-item">
          <div class="cp-hi-top">
            <span class="cp-threat-name">${diseaseName(o.name)}</span>
            <span class="cp-hi-sev" style="background:${s.color}1A;color:${s.color};border:1px solid ${s.color}40">${s.label}</span>
          </div>
          ${blurb ? `<div class="cp-hi-blurb">${blurb.slice(0,120)}${blurb.length>120?'…':''}</div>` : ''}
          <div class="cp-hi-meta">${fmtNum(o.cases||0)} ${ru?'случаев':'cases'}${o.who ? ' · ' + o.who : ''}</div>
        </div>`;
      }).join('') + `</div>`
    : `<div class="cp-no-threats">${ru ? 'Активных болезней не зарегистрировано.' : 'No active disease outbreaks.'}</div>`;

  const foodHtml = foodForCountry.length ? `
    <div class="cp-section-title" style="margin-top:4px">${ru?'Отзывы продуктов':'Food recalls'} <span class="cp-count-tag">${foodForCountry.length}</span></div>
    <div class="cp-food-list">` + foodForCountry.slice(0,4).map(r => `
      <div class="cp-food-item">
        <span class="cp-food-hazard">${(r.hazard||'').split(':')[0].slice(0,18)}</span>
        <div class="cp-food-detail">
          <div class="cp-food-product">${(r.product||'').slice(0,56)}${(r.product||'').length>56?'…':''}</div>
          <div class="cp-food-firm">${r.firm || r.source || ''}</div>
        </div>
      </div>`).join('') + `</div>` : '';

  const healthHtml = `
    <div class="cp-section">
      <div class="cp-section-title">${ru?'Качество воздуха':'Air quality'}</div>
      ${aqiHtml}
    </div>
    <div class="cp-section">
      <div class="cp-section-title">${ru?'Болезни и вспышки':'Diseases & outbreaks'}</div>
      ${diseaseListHtml}
    </div>
    ${foodForCountry.length ? `<div class="cp-section">${foodHtml}</div>` : ''}
    <div class="cp-section" style="border-bottom:0">
      <div class="cp-prov">${provNote}</div>
    </div>`;

  // ── Tab 3: Risk Factors ───────────────────────────
  const CAT_META = {
    health:        { en:'Health & Outbreaks', ru:'Здоровье и вспышки',      icon:'<circle cx="12" cy="12" r="3"/><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2"/>' },
    conflict:      { en:'Armed Conflict',     ru:'Вооружённые конфликты',    icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    civil_unrest:  { en:'Civil Unrest',       ru:'Гражданские беспорядки',   icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
    transport:     { en:'Transport',          ru:'Транспорт',                icon:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>' },
    border:        { en:'Border & Entry',     ru:'Граница и въезд',          icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>' },
    infrastructure:{ en:'Blackout',            ru:'Блэкаут',                  icon:'<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>' },
    climate:       { en:'Climate',            ru:'Климат',                   icon:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' },
  };
  const BAND_CLR = {
    minimal:'var(--s0)',low:'var(--s1)',moderate:'var(--s2)',
    elevated:'var(--s3)',severe:'var(--s4)',high:'var(--s4)',critical:'var(--s5)',
  };

  let riskCatsHtml;
  // Band-level descriptions for each risk category (shown when score > 0)
  const CAT_BAND_DESC = {
    health: {
      ru: { low:'Единичные случаи, риск для туристов невысок', moderate:'Активные вспышки — соблюдайте осторожность', elevated:'Множественные вспышки — консультация врача', severe:'Серьёзные угрозы здоровью', high:'Серьёзные угрозы здоровью', critical:'Чрезвычайная ситуация со здоровьем' },
      en: { low:'Isolated cases, low tourist risk', moderate:'Active outbreaks — take precautions', elevated:'Multiple outbreaks — consult a doctor', severe:'Serious health threats', high:'Serious health threats', critical:'Health emergency' },
    },
    conflict: {
      ru: { low:'Напряжённость в отдельных районах', moderate:'Локальные конфликты, избегайте зон риска', elevated:'Активные боевые действия', severe:'Вооружённый конфликт', high:'Вооружённый конфликт', critical:'Военные действия' },
      en: { low:'Tensions in some areas', moderate:'Localised conflicts, avoid risk zones', elevated:'Active hostilities', severe:'Armed conflict', high:'Armed conflict', critical:'War conditions' },
    },
    civil_unrest: {
      ru: { low:'Периодические протесты', moderate:'Беспорядки и демонстрации', elevated:'Масштабные беспорядки', severe:'Гражданская чрезвычайная ситуация', high:'Гражданская чрезвычайная ситуация', critical:'Гражданская чрезвычайная ситуация' },
      en: { low:'Occasional protests', moderate:'Unrest and demonstrations', elevated:'Widespread unrest', severe:'Civil emergency', high:'Civil emergency', critical:'Civil emergency' },
    },
    transport: {
      ru: { low:'Незначительные перебои', moderate:'Нарушения транспортного сообщения', elevated:'Серьёзные транспортные сбои', severe:'Транспортный коллапс', high:'Транспортный коллапс', critical:'Транспортный коллапс' },
      en: { low:'Minor disruptions', moderate:'Transport disruptions', elevated:'Significant transport failures', severe:'Transport collapse', high:'Transport collapse', critical:'Transport collapse' },
    },
    border: {
      ru: { low:'Усиленный пограничный контроль', moderate:'Ограничения на въезд', elevated:'Жёсткий пограничный режим', severe:'Граница в основном закрыта', high:'Граница в основном закрыта', critical:'Граница закрыта' },
      en: { low:'Enhanced border checks', moderate:'Entry restrictions in place', elevated:'Strict border controls', severe:'Border largely closed', high:'Border largely closed', critical:'Border closed' },
    },
    infrastructure: {
      ru: { low:'Перебои в сети и связи', moderate:'Ограниченный доступ в интернет', elevated:'Массовые отключения интернета или электросети', severe:'Блэкаут — связь и инфраструктура нарушены', high:'Блэкаут — связь и инфраструктура нарушены', critical:'Полное отключение связи и инфраструктуры' },
      en: { low:'Minor connectivity issues', moderate:'Partial internet or grid outages', elevated:'Widespread blackout or internet shutdown', severe:'Major infrastructure blackout', high:'Major infrastructure blackout', critical:'Full connectivity and infrastructure collapse' },
    },
    climate: {
      ru: { low:'Неблагоприятные погодные условия', moderate:'Природные угрозы', elevated:'Значительные стихийные бедствия', severe:'Экстремальные природные условия', high:'Экстремальные природные условия', critical:'Природная катастрофа' },
      en: { low:'Adverse weather conditions', moderate:'Natural hazards present', elevated:'Significant natural disasters', severe:'Extreme conditions', high:'Extreme conditions', critical:'Natural catastrophe' },
    },
  };

  if(riskData){
    const comp     = riskData.composite_risk;
    const compClr  = BAND_CLR[comp.band] || 'var(--s2)';
    const BAND_LBL_RU = {minimal:'Минимальный',low:'Низкий',moderate:'Умеренный',elevated:'Повышенный',severe:'Серьёзный',high:'Высокий',critical:'Критический'};
    const bandLbl  = ru
      ? (BAND_LBL_RU[comp.band] || comp.band)
      : (comp.band.charAt(0).toUpperCase() + comp.band.slice(1));
    riskCatsHtml = `
      <div class="cp-composite">
        <div class="cp-composite-num" style="color:${compClr}">${comp.score.toFixed(1)}</div>
        <div class="cp-composite-info">
          <div class="cp-composite-band" style="color:${compClr}">${bandLbl}</div>
          <div class="cp-composite-sub">${ru?'Композит · 44 источника · 7 доменов':'Composite · 44 sources · 7 domains'}</div>
        </div>
      </div>
      <div class="cp-cats">` +
      Object.entries(riskData.category_breakdown).map(([cat, d]) => {
        const m    = CAT_META[cat] || {en:cat, ru:cat, icon:''};
        const lbl  = ru ? m.ru : m.en;
        const clr  = BAND_CLR[d.band] || 'var(--s0)';
        const w    = Math.round(d.score / 5 * 100);
        // Description shown only when category is active (score > 0)
        const descMap  = CAT_BAND_DESC[cat]?.[ru ? 'ru' : 'en'] || {};
        let desc = d.score > 0 ? (descMap[d.band] || '') : '';
        if(desc && d.active_events) desc += ` · ${d.active_events} ${ru?'соб.':'evt'}`;
        return `<div class="cp-cat-row">
          <div class="cp-cat-hd">
            <span class="cp-cat-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>
              ${lbl}
            </span>
            <span class="cp-cat-score" style="color:${clr}">${d.score.toFixed(1)}</span>
          </div>
          <div class="cp-cat-track"><div class="cp-cat-fill" style="width:${w}%;background:${clr}"></div></div>
          ${desc ? `<div class="cp-cat-desc" style="color:${clr}">${desc}</div>` : ''}
        </div>`;
      }).join('') +
      `</div>`;
  } else {
    // No live event index → NOT an error. "No active threats" is good news.
    // Always show the INFORM structural baseline so the card is never empty.
    const st = iso2 ? COUNTRY_STRUCTURAL[iso2] : null;
    if(st && st.hazard != null){
      const inf = Math.cbrt(st.hazard * st.vulnerability * st.coping); // 0–10
      const band = inf>=6.5 ? {k:'high',c:'#C92A2A',ru:'Высокая уязвимость',en:'High vulnerability'}
                 : inf>=4.5 ? {k:'elevated',c:'#E8590C',ru:'Повышенная уязвимость',en:'Elevated vulnerability'}
                 : inf>=2.5 ? {k:'moderate',c:'#E4B514',ru:'Умеренная устойчивость',en:'Moderate resilience'}
                 :            {k:'low',c:'#19A463',ru:'Высокая устойчивость',en:'High resilience'};
      const bar = (lbl, val) => `<div class="cp-cat-row">
        <div class="cp-cat-hd"><span class="cp-cat-label">${lbl}</span>
          <span class="cp-cat-score" style="color:${band.c}">${val.toFixed(1)}</span></div>
        <div class="cp-cat-track"><div class="cp-cat-fill" style="width:${Math.round(val/10*100)}%;background:${band.c}"></div></div>
      </div>`;
      riskCatsHtml = `
        <div class="cp-composite">
          <div class="cp-composite-num" style="color:#19A463">✓</div>
          <div class="cp-composite-info">
            <div class="cp-composite-band" style="color:#19A463">${ru?'Активных угроз не зафиксировано':'No active threats detected'}</div>
            <div class="cp-composite-sub">${ru?'Нормальное состояние · структурный профиль ниже':'Normal state · structural profile below'}</div>
          </div>
        </div>
        <div class="cp-cats">
          ${bar(ru?'Подверженность угрозам':'Hazard & exposure', st.hazard)}
          ${bar(ru?'Уязвимость':'Vulnerability', st.vulnerability)}
          ${bar(ru?'Дефицит устойчивости':'Lack of coping capacity', st.coping)}
          <div class="cp-cat-desc" style="color:${band.c};margin-top:4px">${ru?band.ru:band.en} · INFORM ${inf.toFixed(1)}/10</div>
        </div>`;
    } else {
      riskCatsHtml = `
        <div class="cp-composite">
          <div class="cp-composite-num" style="color:#19A463">✓</div>
          <div class="cp-composite-info">
            <div class="cp-composite-band" style="color:#19A463">${ru?'Активных угроз не зафиксировано':'No active threats detected'}</div>
            <div class="cp-composite-sub">${ru?'Нормальное состояние. Отсутствие событий ≠ гарантия безопасности.':'Normal state. Absence of events is not an all-clear.'}</div>
          </div>
        </div>`;
    }
  }

  // Trim news-style event names (strip " - SourceName" suffix, cap at 72 chars)
  const trimEvName = n => {
    const s = (n || '').replace(/\s+-\s+\S[^-]{0,40}$/, '').trim();
    return s.length > 72 ? s.slice(0,72)+'…' : s;
  };

  const secEventsHtml = [...disasters, ...humanitarians].length ? `
    <div class="cp-section">
      <div class="cp-section-title">${ru?'Активные события':'Active events'}</div>
      <div class="cp-health-list">` +
      [...disasters, ...humanitarians].map(o => {
        const s = SEV[o.sev];
        const blurb = (ru ? o.blurb_ru : o.blurb) || o.summary || '';
        return `<div class="cp-health-item">
          <div class="cp-hi-top">
            <span class="cp-threat-name">${trimEvName(diseaseName(o.name))}</span>
            <span class="cp-hi-sev" style="background:${s.color}1A;color:${s.color};border:1px solid ${s.color}40">${s.label}</span>
          </div>
          ${blurb ? `<div class="cp-hi-blurb">${blurb.slice(0,120)}${blurb.length>120?'…':''}</div>` : ''}
        </div>`;
      }).join('') + `</div></div>` : '';

  // Macro explainability panel (shown when we have any macro data for this ISO)
  const _cm = iso2 ? COUNTRY_MACRO[iso2] : null;
  const macroPanel = _cm ? (() => {
    const cell = (lbl, val, suffix, hot) =>
      val == null ? '' :
      `<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0">
         <span style="color:var(--muted)">${lbl}</span>
         <b style="color:${hot?'#C92A2A':'#14110C'}">${val}${suffix||''}</b>
       </div>`;
    return `
      <div class="cp-section">
        <div class="cp-section-title">${ru?'Макроэкономика':'Macro'} <span style="font-size:10.5px;color:#B5AFA4;font-weight:500;letter-spacing:.04em">${ru?'· запаздывающее, объяснимость':'· lagging, explainability'}</span></div>
        ${cell(ru?'ВВП г/г':'GDP YoY', _cm.gdp_yoy_pct, '%', _cm.gdp_yoy_pct!=null && _cm.gdp_yoy_pct<0)}
        ${cell(ru?'Безработица':'Unemployment', _cm.unemp_pct, '%', _cm.unemp_2yr_delta_pp>=2)}
        ${_cm.unemp_2yr_delta_pp!=null ? cell(ru?'  Δ за 2 года':'  Δ 2yr', (_cm.unemp_2yr_delta_pp>0?'+':'')+_cm.unemp_2yr_delta_pp, 'pp', _cm.unemp_2yr_delta_pp>=2) : ''}
        ${cell(ru?'Долг / ВВП':'Debt / GDP', _cm.debt_to_gdp_pct, '%', _cm.debt_5yr_delta_pp>=25)}
        ${_cm.debt_5yr_delta_pp!=null ? cell(ru?'  Δ за 5 лет':'  Δ 5yr', (_cm.debt_5yr_delta_pp>0?'+':'')+_cm.debt_5yr_delta_pp, 'pp', _cm.debt_5yr_delta_pp>=25) : ''}
        ${cell(ru?'Ставка ЦБ':'Policy rate', _cm.policy_rate_pct, '%', _cm.policy_rate_pct>=20)}
      </div>`;
  })() : '';

  const riskTabHtml = `
    <div class="cp-section">
      <div class="cp-section-title">${ru?'Индекс риска по доменам':'Risk index by domain'}</div>
      ${riskCatsHtml}
    </div>
    ${macroPanel}
    ${osintObserverPanel(country)}
    ${secEventsHtml}
    <div class="cp-section" style="border-bottom:0">
      <div class="cp-prov">${ru
        ? 'Композитный индекс — агрегат 44 верифицированных потоков. Не является официальной рекомендацией МИД.'
        : 'Composite index — aggregate of 44 verified streams. Not an official government travel advisory.'}</div>
    </div>`;

  // ── Render ────────────────────────────────────────
  document.querySelector('.panel-scroll').innerHTML = `
    <div class="cp-head" style="border-top:4px solid ${sev.color}">
      <div class="cp-back" id="cpBack">${ru?'Назад':'Back'}</div>
      <div class="cp-eyebrow">${ru?'Профиль страны':'Country Profile'}</div>
      <div class="cp-country-name">${cname}</div>
      <div class="cp-advisory" style="background:${adv.bg};border:1px solid ${adv.border||adv.bg}">
        <span class="adv-dot" style="background:${adv.dot}"></span><span>${adv.label}</span>
      </div>
    </div>

    <div class="cp-tabs" id="cpTabs">
      <button class="cp-tab is-active" data-tab="main">${ru?'Обзор':'Overview'}</button>
      <button class="cp-tab" data-tab="health">${ru?'Здоровье':'Health'}</button>
      <button class="cp-tab" data-tab="risk">${ru?'Риски':'Risk'}</button>
      <button class="cp-tab" data-tab="hist">${ru?'История':'History'}</button>
    </div>

    <div class="cp-tabbody" data-body="main">${overviewHtml}</div>
    <div class="cp-tabbody" data-body="health" style="display:none">${healthHtml}</div>
    <div class="cp-tabbody" data-body="risk"   style="display:none">${riskTabHtml}</div>
    <div class="cp-tabbody" data-body="hist"   style="display:none"><div class="cp-section">${histBody}</div></div>
  `;

  // Tab switching
  const tabsEl = document.getElementById('cpTabs');
  if(tabsEl){
    tabsEl.addEventListener('click', e => {
      const b = e.target.closest('.cp-tab');
      if(!b) return;
      tabsEl.querySelectorAll('.cp-tab').forEach(x => x.classList.toggle('is-active', x === b));
      document.querySelectorAll('.panel-scroll .cp-tabbody').forEach(bd => {
        bd.style.display = bd.dataset.body === b.dataset.tab ? '' : 'none';
      });
      if(b.dataset.tab === 'hist' && window.ym) ym(109240834, 'reachGoal', 'history_view');
    });
  }

  // Back button
  document.getElementById('cpBack')?.addEventListener('click', () => selectCountry(null));

  // Assess risks button
  const assessBtn = document.getElementById('cpAssessBtn');
  if(assessBtn){
    updateAssessCounter();
    assessBtn.addEventListener('click', function(){
      if(!useAssessment()){
        assessBtn.classList.add('assess-limit');
        const ru = LANG === 'ru';
        const msg = ru ? 'Лимит оценок исчерпан' : 'Assessment limit reached';
        const counter = document.getElementById('assessCounter');
        if(counter){ counter.textContent = msg; counter.style.color = 'var(--red, #C92A2A)'; }
        return;
      }
      openRiskReport(country);
    });
  }

  // Subscribe form
  const subForm = document.querySelector('.cp-subscribe');
  if(subForm){
    subForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn      = subForm.querySelector('.cp-sub-btn');
      const statusEl = subForm.querySelector('.cp-sub-status');
      const email    = subForm.querySelector('.cp-sub-input').value.trim();
      if(!email) return;
      btn.disabled = true;
      statusEl.textContent = ru ? 'Отправляем…' : 'Sending…';
      try {
        const res  = await fetch('/api/subscribe', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email, country: subForm.dataset.country, lang: subForm.dataset.lang }),
        });
        const json = await res.json();
        if(!res.ok) throw new Error(json.error || 'failed');
        statusEl.textContent = ru ? 'Проверь почту — там ссылка.' : 'Check your inbox to confirm.';
        subForm.querySelector('.cp-sub-input').value = '';
        track('Alert Subscribe', { country: subForm.dataset.country || 'global' });
      } catch(_err){
        statusEl.textContent = ru ? 'Не удалось. Попробуй ещё раз.' : 'Failed. Please try again.';
      } finally { btn.disabled = false; }
    });
  }
}

const SEV = {
  monitoring:  { idx:0, color:'#A09F95', dark:'#807E76', light:'#B8B7AD', label: STRINGS[LANG]?.sevLabel?.monitoring || 'Monitor' },
  low:         { idx:1, color:'#E4B514', dark:'#B28A0E', light:'#F2C73D', label: STRINGS[LANG]?.sevLabel?.low || 'Low' },
  warning:     { idx:2, color:'#E8590C', dark:'#B84408', light:'#F47521', label: STRINGS[LANG]?.sevLabel?.warning || 'Warning' },
  alert:       { idx:3, color:'#C92A2A', dark:'#9F1F1F', light:'#E03A3A', label: STRINGS[LANG]?.sevLabel?.alert || 'Alert' },
  critical:    { idx:4, color:'#8B1A1A', dark:'#6E1414', light:'#A02222', label: STRINGS[LANG]?.sevLabel?.critical || 'Critical' },
  catastrophic:{ idx:5, color:'#5C2010', dark:'#421710', light:'#7A2A18', label: STRINGS[LANG]?.sevLabel?.catastrophic || 'Catastrophic' },
};

/* ── Category definitions (inline SVG icons — Lucide-style) ─ */
const CATEGORY_META = {
  epidemic:     { color:'#C92A2A', en:'Epidemics',    ru:'Эпидемии',    type:'epidemic',
                  icon:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7.05 7.05 5.64 5.64M18.36 18.36l-1.41-1.41M7.05 16.95l-1.41 1.41M18.36 5.64l-1.41 1.41"/></svg>' },
  disaster:     { color:'#1D6FA4', en:'Disasters',    ru:'Катастрофы',  type:'disaster',
                  icon:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>' },
  air:          { color:'#6B7F3A', en:'Air Quality',  ru:'Воздух',      type:'air',
                  icon:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M17.73 2.27A2.5 2.5 0 1 1 19.5 6.5H2"/><path d="M14.5 15.5A2.5 2.5 0 1 0 16.5 19H2"/></svg>' },
  food:         { color:'#A0522D', en:'Food Safety',  ru:'Еда',         type:'food',
                  icon:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/></svg>' },
  humanitarian: { color:'#8B5CF6', en:'Humanitarian', ru:'Гуманитар.',  type:'humanitarian',
                  icon:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>' },
  blackout:     { color:'#B45309', en:'Blackout',     ru:'Блэкаут',     type:'blackout',
                  icon:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>' },
};

function catLabel(key){ return LANG==='ru' ? CATEGORY_META[key].ru : CATEGORY_META[key].en; }
function toggleCat(key){
  state.cats[key] = !state.cats[key];
  const toggle  = document.querySelector(`.sw-toggle[data-cat="${key}"]`);
  const section = document.querySelector(`.cat-section[data-cat="${key}"]`);
  if(toggle)  toggle.classList.toggle('is-on', !!state.cats[key]);
  if(section) section.classList.toggle('cat-off', !state.cats[key]);
  if(key === 'air' && map) showAQILayer(state.cats.air);
  renderList();
  applyGLFilters();
}

function renderCatLists(){
  const CATS = ['epidemic','disaster','air','food','humanitarian','blackout'];
  for(const cat of CATS){
    const items = OUTBREAKS.filter(o => (o.type||'epidemic') === cat);
    const countEl = document.getElementById(`catCount-${cat}`);
    if(countEl) countEl.textContent = items.length;

    const listEl = document.getElementById(`catList-${cat}`);
    if(!listEl) continue;

    listEl.innerHTML = items.map(o => {
      const sev  = SEV[o.sev] || SEV.warning;
      const c    = sev.color;
      const bg   = hexA(c, 0.12);
      const loc  = o.country ? (countryName(o.country)||o.country) : '';
      return `<div class="cat-item${o.id===state.selectedId?' is-selected':''}" data-id="${o.id}">
        <span class="cat-item-dot" style="background:${c}"></span>
        <div class="cat-item-info">
          <div class="cat-item-name">${diseaseName(o)}</div>
          <div class="cat-item-loc">${loc}</div>
        </div>
        <span class="cat-item-sev" style="background:${bg};color:${c}">${sev.label}</span>
      </div>`;
    }).join('') || '';

    listEl.querySelectorAll('.cat-item').forEach(el => {
      el.addEventListener('click', () => selectOutbreak(el.dataset.id));
    });
  }
}

/* ── Demo data for new categories ───────────────────────── */
const CAT_EVENTS = [
  // Air quality
  { id:'air-delhi',  type:'air', name:'Air Quality — Critical', name_ru:'Качество воздуха — критич.', country:'India',  region:'SEARO', lat:28.6, lng:77.2,  sev:'alert',      cases:null, deaths:null, summary:'PM2.5 AQI 285 — Very Unhealthy. Avoid outdoor activity. Wear N95 masks.', summary_ru:'PM2.5 АКИ 285 — Очень вредно. Избегать прогулок. Носить маску N95.', who:'Open-Meteo AQI', iso:356 },
  { id:'air-beijing',type:'air', name:'Air Quality — Elevated', name_ru:'Качество воздуха — повыш.',  country:'China',  region:'WPRO',  lat:39.9, lng:116.4, sev:'warning',    cases:null, deaths:null, summary:'PM2.5 AQI 158 — Unhealthy. Sensitive groups should avoid prolonged outdoor exposure.', summary_ru:'PM2.5 АКИ 158 — Вредно. Уязвимым группам ограничить пребывание на воздухе.', who:'Open-Meteo AQI', iso:156 },
  { id:'air-dhaka',  type:'air', name:'Air Quality — Hazardous',name_ru:'Качество воздуха — опасно', country:'Bangladesh',region:'SEARO',lat:23.7, lng:90.4,  sev:'critical',  cases:null, deaths:null, summary:'PM2.5 AQI 320 — Hazardous. Stay indoors, use air purifiers. Health alert for all.', summary_ru:'PM2.5 АКИ 320 — Опасно. Оставаться в помещениях. Санитарное предупреждение всем.', who:'Open-Meteo AQI', iso:50 },
  { id:'air-karachi',type:'air', name:'Air Quality — Unhealthy', name_ru:'Качество воздуха — вредно',  country:'Pakistan',region:'EMRO', lat:24.9, lng:67.0,  sev:'warning',   cases:null, deaths:null, summary:'PM2.5 AQI 172 — Unhealthy. Reduce prolonged outdoor exertion.', summary_ru:'PM2.5 АКИ 172 — Вредно. Снизить физическую активность на улице.', who:'Open-Meteo AQI', iso:586 },
  // Disasters (GDACS-sourced, updated manually to reflect current events)
  { id:'dis-myanmar-eq',  type:'disaster', name:'Earthquake M7.7',       name_ru:'Землетрясение М7.7',    country:'Myanmar',   region:'SEARO', lat:21.9,  lng:95.9,  sev:'critical', cases:3600,  deaths:3700, summary:'Catastrophic 7.7M earthquake struck central Myanmar (Mandalay region). Over 3 700 confirmed dead, 3 600 injured. Widespread building collapse, dam damage, displacement of 1.5M+ people. Aftershock sequence ongoing. GDACS Red alert.', summary_ru:'Катастрофическое землетрясение М7.7 в центральной Мьянме (регион Мандалай). Более 3 700 погибших, 3 600 раненых. Массовый обвал зданий, повреждение дамб, 1,5 млн перемещённых. Продолжаются афтершоки. Красный алерт GDACS.', who:'GDACS · USGS', iso:104 },
  { id:'dis-brazil-fl',   type:'disaster', name:'Catastrophic Floods',   name_ru:'Катастрофическое наводнение', country:'Brazil', region:'AMRO', lat:-30.0, lng:-51.2, sev:'alert',    cases:800,   deaths:170,  summary:'Severe flooding in Rio Grande do Sul and Santa Catarina states. 170+ dead, 800 injured, 400 000 displaced. Infrastructure collapse — roads, bridges, power grid disrupted across 300+ municipalities.', summary_ru:'Сильные наводнения в штатах Риу-Гранди-ду-Сул и Санта-Катарина. 170+ погибших, 800 пострадавших, 400 000 перемещённых. Коллапс инфраструктуры в 300+ муниципалитетах.', who:'GDACS · CEMADEN', iso:76 },
  { id:'dis-somalia-dr',  type:'disaster', name:'Severe Drought',        name_ru:'Сильная засуха',         country:'Somalia',   region:'AFRO', lat:5.2,   lng:46.2,  sev:'critical', cases:null,  deaths:null, summary:'La Niña-driven drought has decimated 70% of crops. IPC Phase 4 (Emergency) for 4.3M people; Famine (Phase 5) declared in Baidoa and Lower Shabelle. Acute malnutrition rising sharply.', summary_ru:'Засуха из-за Ла-Нинья уничтожила 70% урожая. МПК Фаза 4 (Чрезвычайная) для 4,3 млн; Голод (Фаза 5) объявлен в Байдоа и Нижнем Шабелле. Острое недоедание резко растёт.', who:'FAO · FEWS NET', iso:706 },
  { id:'dis-indonesia-eq',type:'disaster', name:'Earthquake M6.2',       name_ru:'Землетрясение М6.2',    country:'Indonesia', region:'SEARO', lat:-8.6,  lng:115.2, sev:'warning',  cases:1200,  deaths:43,   summary:'M6.2 earthquake struck Lombok Island, Indonesia. 43 dead, 1 200 injured. Tsunami advisory lifted. Tourism areas damaged; evacuation of coastal zones underway. GDACS Orange alert.', summary_ru:'Землетрясение М6.2 на острове Ломбок, Индонезия. 43 погибших, 1 200 пострадавших. Предупреждение о цунами снято. Повреждены туристические зоны, проводится эвакуация прибрежных районов. Оранжевый алерт GDACS.', who:'GDACS · BMKG', iso:360 },
  { id:'dis-pakistan-fl', type:'disaster', name:'Monsoon Floods',        name_ru:'Муссонные наводнения',  country:'Pakistan',  region:'EMRO', lat:30.4,  lng:69.3,  sev:'alert',    cases:2100,  deaths:290,  summary:'Pre-monsoon and glacier lake outburst floods (GLOFs) affecting KPK and Balochistan provinces. 290 dead, 2 100 injured, 1.2M people affected. Crop losses >60% in affected districts.', summary_ru:'Наводнения из-за прорыва ледниковых озёр в провинциях КПК и Белуджистан. 290 погибших, 2 100 пострадавших, 1,2 млн пострадавших. Потери урожая >60% в пострадавших районах.', who:'GDACS · NDMA', iso:586 },
  { id:'dis-vanuatu-tc',  type:'disaster', name:'Tropical Cyclone Cat.4',name_ru:'Тропический циклон 4 кат.',country:'Vanuatu', region:'WPRO', lat:-17.7, lng:168.3, sev:'warning',  cases:350,   deaths:12,   summary:'Category 4 cyclone made landfall on Efate Island, Vanuatu. 12 dead, 350 injured. 85% of structures damaged on Efate. International humanitarian response activated. GDACS Orange alert.', summary_ru:'Циклон 4 категории достиг о. Эфате, Вануату. 12 погибших, 350 пострадавших. Повреждены 85% строений. Активирована международная гуманитарная помощь. Оранжевый алерт GDACS.', who:'GDACS · VMGD', iso:548 },
  // Food safety
  { id:'food-listeria', type:'food', name:'Listeria Outbreak',  name_ru:'Листериоз', country:'United States', region:'AMRO', lat:38.9, lng:-95.7, sev:'alert',   cases:22, deaths:4, summary:'Multi-state listeria outbreak linked to deli meats. FDA recall issued. Check fridges for affected products.', summary_ru:'Вспышка листериоза в нескольких штатах — заражённая мясная нарезка. Отзыв FDA. Проверьте холодильники.', who:'openFDA', iso:840 },
  { id:'food-salmonella',type:'food',name:'Salmonella Alert',   name_ru:'Сальмонеллёз', country:'Germany', region:'EURO', lat:51.2, lng:10.4, sev:'warning',  cases:147, deaths:1, summary:'Salmonella Enteritidis cluster traced to eggs from Rhine-Westphalia farms. RASFF notification issued.', summary_ru:'Вспышка сальмонеллёза — яйца с ферм Рейн-Вестфалии. Оповещение RASFF. Тщательно готовьте яйца.', who:'RASFF', iso:276 },
  { id:'food-ecoli',    type:'food', name:'E.coli O157 Cluster', name_ru:'E.coli O157', country:'France', region:'EURO', lat:46.2, lng:2.2,  sev:'warning',  cases:38, deaths:0, summary:'E.coli O157:H7 cluster in Normandy linked to unpasteurised cheese. EFSA alert. Avoid raw dairy products.', summary_ru:'Вспышка E.coli O157 в Нормандии — непастеризованный сыр. Предупреждение EFSA. Избегать сырых молочных продуктов.', who:'RASFF', iso:250 },
  // Humanitarian
  { id:'hum-gaza',     type:'humanitarian', name:'Humanitarian Crisis',  name_ru:'Гуманитарный кризис', country:'Palestinian Territories', region:'EMRO', lat:31.5, lng:34.5, sev:'critical',  cases:null, deaths:null, summary:'Acute food insecurity and healthcare system collapse. WHO reports 90%+ hospital non-functionality. IPC Phase 4-5.', summary_ru:'Острая нехватка еды и коллапс системы здравоохранения. ВОЗ: 90% больниц не работают. МПК Фаза 4-5.', who:'ReliefWeb', iso:0 },
  { id:'hum-sudan',    type:'humanitarian', name:'Displacement Crisis',  name_ru:'Кризис перемещения',  country:'Sudan', region:'AFRO', lat:15.5, lng:32.5, sev:'critical',  cases:null, deaths:null, summary:'11M+ internally displaced. Cholera, measles, malnutrition surging in camps. Largest displacement crisis globally.', summary_ru:'11+ млн внутренне перемещённых. В лагерях растут холера, корь, недоедание. Крупнейший в мире кризис перемещения.', who:'UNHCR', iso:729 },
  { id:'hum-myanmar',  type:'humanitarian', name:'Healthcare Collapse',  name_ru:'Коллапс здравоохранения', country:'Myanmar', region:'SEARO', lat:16.9, lng:96.1, sev:'alert', cases:null, deaths:null, summary:'Ongoing conflict destroyed 60%+ of primary healthcare facilities. Malaria and dengue resurging. 18M need assistance.', summary_ru:'Конфликт уничтожил 60%+ первичных учреждений здравоохранения. Рост малярии и денге. 18 млн нуждаются в помощи.', who:'OCHA', iso:104 },
];

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

// Inject category events into OUTBREAKS at load time
CAT_EVENTS.forEach(ev => {
  if(!OUTBREAKS.find(o=>o.id===ev.id)){
    OUTBREAKS.push({
      ...ev,
      name: ev.name,
      blurb: ev.summary,
      blurb_ru: ev.summary_ru,
      place: ev.country,
      lon: ev.lng,
      trend: [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      rt: 0, cfr: 0, new24: 0, sevIdx: {critical:75,alert:55,warning:35,monitoring:15}[ev.sev]||20,
      events: [],
      code: `CAT-${ev.type.toUpperCase()}-${ev.id}`,
    });
  }
});

const HIGHLIGHT_ISO = new Set(OUTBREAKS.map(o=>o.iso));

/* =========================================================
   STATE & MAPBOX SETUP
   ========================================================= */
const stage   = document.getElementById('stage');
const globeEl = document.getElementById('globe');

mapboxgl.accessToken = 'pk.eyJ1IjoiYXJhYmxleCIsImEiOiJjbXA1M2wxbWExM25xMnFxeWJzZG9tOWJuIn0.PJ8o0uIDJDvtKib-EoKXBw';

const state = {
  filter: 'all',
  query: '',
  selectedId: null,
  selectedCountry: null,
  cats: { epidemic:true, disaster:true, air:false, food:false, humanitarian:false, blackout:false },
  hoveredId: null,
  countries: [],
  t: 0,
  listGroup: 'none',   // 'none' | 'country' | 'type'
  listSort: 'sev',     // 'sev' | 'date' | 'az'
};

let map = null;
let _markerClicked = false;
let _countryClickBound = false;
let _mapLoadedOnce = false;   // true after first 'load' — gates layer re-add on setStyle

/* ── AQI Layer (WAQI real-time air quality) ───────────────────── */
let _aqiActive  = false;
let _aqiTimer   = null;

const AQI_CATS = [
  { max:  50, color:'#19A463', label:'Good',             labelRu:'Хорошее' },
  { max: 100, color:'#E4B514', label:'Moderate',         labelRu:'Умеренное' },
  { max: 150, color:'#E8590C', label:'Unhealthy (SG)',   labelRu:'Вредно (чувств.)' },
  { max: 200, color:'#C92A2A', label:'Unhealthy',        labelRu:'Вредное' },
  { max: 300, color:'#8B1A1A', label:'Very Unhealthy',   labelRu:'Очень вредное' },
  { max: 999, color:'#5C2010', label:'Hazardous',        labelRu:'Опасное' },
];

function aqiCat(val){
  return AQI_CATS.find(c => val <= c.max) || AQI_CATS[AQI_CATS.length - 1];
}

// Sample stations for dev/fallback (real data via /api/aqi in production)
const AQI_SAMPLE = [
  {lon:77.2,lat:28.6,aqi:285,uid:1,station:{name:'Delhi — Anand Vihar'}},
  {lon:116.4,lat:39.9,aqi:158,uid:2,station:{name:'Beijing — Dongcheng'}},
  {lon:90.4,lat:23.7,aqi:320,uid:3,station:{name:'Dhaka — Dhanmondi'}},
  {lon:67.0,lat:24.9,aqi:172,uid:4,station:{name:'Karachi — Keamari'}},
  {lon:120.9,lat:14.6,aqi:88,uid:5,station:{name:'Manila — Taguig'}},
  {lon:106.8,lat:-6.2,aqi:145,uid:6,station:{name:'Jakarta — South Jakarta'}},
  {lon:36.8,lat:34.7,aqi:62,uid:7,station:{name:'Adana'}},
  {lon:31.2,lat:30.0,aqi:109,uid:8,station:{name:'Cairo — Helwan'}},
  {lon:28.0,lat:-26.2,aqi:48,uid:9,station:{name:'Johannesburg — Bram Fischer'}},
  {lon:-43.2,lat:-22.9,aqi:74,uid:10,station:{name:'Rio de Janeiro — Centro'}},
  {lon:-58.4,lat:-34.6,aqi:39,uid:11,station:{name:'Buenos Aires — Palermo'}},
  {lon:-99.1,lat:19.4,aqi:131,uid:12,station:{name:'Mexico City — Pedregal'}},
  {lon:-74.1,lat:4.7,aqi:56,uid:13,station:{name:'Bogotá — Las Ferias'}},
  {lon:2.4,lat:48.9,aqi:44,uid:14,station:{name:'Paris — Les Halles'}},
  {lon:13.4,lat:52.5,aqi:33,uid:15,station:{name:'Berlin — Mitte'}},
  {lon:37.6,lat:55.8,aqi:67,uid:16,station:{name:'Moscow — Botanichesky'}},
  {lon:72.9,lat:19.1,aqi:189,uid:17,station:{name:'Mumbai — Worli'}},
  {lon:80.3,lat:13.0,aqi:95,uid:18,station:{name:'Chennai — Manali'}},
  {lon:88.4,lat:22.6,aqi:210,uid:19,station:{name:'Kolkata — Rabindra Sarani'}},
  {lon:103.8,lat:1.4,aqi:42,uid:20,station:{name:'Singapore — Woodlands'}},
  {lon:126.9,lat:37.5,aqi:78,uid:21,station:{name:'Seoul — Jongno-gu'}},
  {lon:139.7,lat:35.7,aqi:52,uid:22,station:{name:'Tokyo — Shinjuku'}},
  {lon:100.5,lat:13.7,aqi:114,uid:23,station:{name:'Bangkok — Din Daeng'}},
  {lon:21.0,lat:52.2,aqi:55,uid:24,station:{name:'Warsaw — Marszalkowska'}},
  {lon:-87.6,lat:41.9,aqi:29,uid:25,station:{name:'Chicago — CDOT — 18'}},
  {lon:-118.2,lat:34.1,aqi:61,uid:26,station:{name:'Los Angeles — Reseda'}},
  {lon:-0.1,lat:51.5,aqi:37,uid:27,station:{name:'London — Marylebone Road'}},
  {lon:151.2,lat:-33.9,aqi:22,uid:28,station:{name:'Sydney — Parramatta North'}},
];

/* World cities (pop ≥ 200k) — geo anchors for AQI, loaded once.
   Format: [[lat, lon, "Name"], ...] sorted by population desc. */
let CITIES = [];
async function loadCities(){
  if(CITIES.length) return;
  try{
    const base = window.EPISWOPE_BASE || './';
    const res  = await fetch(base + 'public/cities.json');
    if(res.ok) CITIES = await res.json();
  }catch(e){ console.warn('[AQI] cities.json', e); }
}

async function fetchAQI(){
  if(!map || !_aqiActive) return;
  await loadCities();
  const b = map.getBounds();
  const S=b.getSouth(), N=b.getNorth(), W=b.getWest(), E=b.getEast();
  const MAX_PTS = 45;

  // Anchor AQI to REAL cities in view (not a mechanical grid).
  // CITIES is pop-sorted, so first-N-in-bounds = the most significant
  // cities → looks geographic, never a lattice.
  const inBounds = c => {
    const la=c[0], lo=c[1];
    return la>=S && la<=N && (W<=E ? (lo>=W && lo<=E) : (lo>=W || lo<=E));
  };
  let pts = [];
  for(const c of CITIES){
    if(inBounds(c)){ pts.push({ lat:c[0], lon:c[1], name:c[2] }); if(pts.length>=MAX_PTS) break; }
  }

  let stations = [];
  if(pts.length){
    try{
      const lats = pts.map(p=>p.lat).join(',');
      const lons = pts.map(p=>p.lon).join(',');
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi`;
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const j = await res.json();
      const arr = Array.isArray(j) ? j : [j];   // multi→array, single→object
      stations = arr.map((o,i)=>{
        const aqi = o?.current?.us_aqi;
        if(aqi == null) return null;
        const p = pts[i] || {};
        return { lat:p.lat, lon:p.lon, aqi:Math.round(aqi), uid:`om-${i}`,
                 station:{ name: p.name || (LANG==='ru'?'Качество воздуха':'Air quality') } };
      }).filter(Boolean);
    }catch(e){ console.warn('[AQI] open-meteo', e); }
  }
  // Last-resort fallback: bundled sample within bounds
  if(!stations.length){
    stations = AQI_SAMPLE.filter(s => s.lat>=S && s.lat<=N && s.lon>=W && s.lon<=E);
    if(!stations.length) stations = AQI_SAMPLE;
  }
  try {
    const json = { status:'ok', data: stations };
    if(json.status !== 'ok' || !Array.isArray(json.data)) return;

    const features = json.data
      .filter(s => typeof s.aqi === 'number' && s.aqi >= 0)
      .map(s => {
        const cat = aqiCat(s.aqi);
        return {
          type: 'Feature',
          geometry: { type:'Point', coordinates:[s.lon, s.lat] },
          properties: {
            uid:     s.uid,
            station: s.station?.name || '',
            aqi:     s.aqi,
            aqiStr:  String(s.aqi),
            color:   cat.color,
          },
        };
      });

    const gj = { type:'FeatureCollection', features };
    const src = map.getSource('aqi-src');
    if(src){
      src.setData(gj);
      ['aqi-glow','aqi-heat','aqi-circles','aqi-labels'].forEach(id => {
        if(map.getLayer(id)) map.setLayoutProperty(id,'visibility','visible');
      });
      return;
    }

    map.addSource('aqi-src', { type:'geojson', data:gj });

    // Soft glow blobs per station (visible at any zoom)
    map.addLayer({
      id: 'aqi-glow',
      type: 'circle',
      source: 'aqi-src',
      paint: {
        'circle-radius':  ['interpolate',['linear'],['zoom'], 0,55, 3,70, 6,50, 8,30],
        'circle-color':   ['get','color'],
        'circle-opacity': 0.22,
        'circle-blur':    1,
        'circle-stroke-width': 0,
      },
    }, 'waterway-label');

    // Heatmap density wash (accumulates where stations cluster)
    map.addLayer({
      id: 'aqi-heat',
      type: 'heatmap',
      source: 'aqi-src',
      maxzoom: 8,
      paint: {
        'heatmap-weight':    ['interpolate',['linear'],['get','aqi'], 0,0.25, 100,0.55, 200,0.8, 300,1],
        'heatmap-intensity': ['interpolate',['linear'],['zoom'], 0,3, 3,2.5, 6,2, 8,1.5],
        'heatmap-color': [
          'interpolate',['linear'],['heatmap-density'],
          0,   'rgba(25,164,99,0)',
          0.12,'rgba(25,164,99,0.5)',
          0.3, 'rgba(228,181,20,0.62)',
          0.55,'rgba(232,89,12,0.72)',
          0.78,'rgba(201,42,42,0.82)',
          1,   'rgba(92,32,16,0.92)',
        ],
        'heatmap-radius':  ['interpolate',['linear'],['zoom'], 0,80, 2,65, 5,45, 8,28],
        'heatmap-opacity': 0.82,
      },
    }, 'waterway-label');

    // Station circles
    map.addLayer({
      id: 'aqi-circles',
      type: 'circle',
      source: 'aqi-src',
      minzoom: 2,
      paint: {
        'circle-radius':       ['interpolate',['linear'],['zoom'], 2,5, 6,10, 9,16],
        'circle-color':        ['get','color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255,255,255,0.85)',
        'circle-opacity':      0.92,
      },
    });

    // AQI numbers (visible from zoom 5+)
    map.addLayer({
      id: 'aqi-labels',
      type: 'symbol',
      source: 'aqi-src',
      minzoom: 5,
      layout: {
        'text-field':          ['get','aqiStr'],
        'text-font':           ['DIN Pro Bold','Arial Unicode MS Bold'],
        'text-size':           ['interpolate',['linear'],['zoom'], 5,8, 9,12],
        'text-allow-overlap':  true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color':'#fff', 'text-halo-color':'rgba(0,0,0,0.15)', 'text-halo-width':0.5 },
    });

    // Click on station
    map.on('click','aqi-circles', e => {
      _markerClicked = true;
      const p = e.features[0]?.properties;
      if(p) renderAQIPanel(p);
    });
    map.on('mouseenter','aqi-circles', () => { map.getCanvas().style.cursor='pointer'; });
    map.on('mouseleave','aqi-circles', () => { map.getCanvas().style.cursor=''; });

  } catch(e){ console.warn('[AQI]', e); }
}

function showAQILayer(on){
  _aqiActive = on;
  clearTimeout(_aqiTimer);
  if(on){
    fetchAQI();
    // auto-refresh on map move
    map.on('moveend', _onAQIMove);
  } else {
    map.off('moveend', _onAQIMove);
    ['aqi-glow','aqi-heat','aqi-circles','aqi-labels'].forEach(id => {
      if(map.getLayer(id)) map.setLayoutProperty(id,'visibility','none');
    });
  }
}

function _onAQIMove(){
  if(!_aqiActive) return;
  clearTimeout(_aqiTimer);
  _aqiTimer = setTimeout(fetchAQI, 600);
}

function renderAQIPanel(p){
  const aqi = p.aqi;
  const cat = aqiCat(aqi);
  const label = LANG === 'ru' ? cat.labelRu : cat.label;
  const name  = p.station || (LANG === 'ru' ? 'Станция мониторинга' : 'Monitoring station');

  // Open panel
  const panel = document.getElementById('panel');
  if(panel && window.innerWidth <= 768) panel.classList.add('mob-open');

  const panelScroll = document.querySelector('.panel-scroll');
  if(!panelScroll) return;

  panelScroll.innerHTML = `
    <div style="padding:16px 18px 24px">
      <div style="font-size:10.5px;font-weight:700;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px">
        ${LANG==='ru'?'Качество воздуха · WAQI':'Air Quality · WAQI'}
      </div>

      <!-- AQI Hero -->
      <div style="background:${cat.color};border-radius:14px;padding:18px 20px 16px;margin-bottom:16px;color:#fff">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="font-size:48px;font-weight:900;letter-spacing:-0.04em;line-height:1">${aqi}</div>
          <div>
            <div style="font-size:17px;font-weight:700;margin-bottom:3px">${label}</div>
            <div style="font-size:11px;opacity:0.82">US AQI</div>
          </div>
        </div>
      </div>

      <!-- Station name -->
      <div style="font-size:16px;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px">${name}</div>

      <!-- AQI scale bar -->
      <div style="margin:16px 0 20px">
        <div style="font-size:10px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">
          ${LANG==='ru'?'Шкала AQI':'AQI Scale'}
        </div>
        <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px">
          ${AQI_CATS.map((c,i)=>`<div style="flex:1;background:${c.color};${aqi<=(i===0?c.max:AQI_CATS[i-1].max)?'':''}opacity:${aqiCat(aqi)===c?1:0.35}"></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px;color:var(--muted)">
          <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span>
        </div>
      </div>

      <!-- Health advice -->
      <div style="background:var(--line-2,#F2F0E8);border-radius:11px;padding:13px 14px;font-size:12.5px;line-height:1.55;color:var(--ink-2)">
        ${_aqiAdvice(aqi)}
      </div>

      <div style="margin-top:16px;font-size:10px;color:var(--muted)">
        ${LANG==='ru'?'Данные: WAQI · aqicn.org':'Source: WAQI · aqicn.org'}
      </div>
    </div>
  `;
}

function _aqiAdvice(aqi){
  if(LANG === 'ru'){
    if(aqi <=  50) return 'Качество воздуха хорошее. Активности на улице безопасны.';
    if(aqi <= 100) return 'Приемлемо. Чувствительным людям рекомендуется ограничить длительное пребывание на улице.';
    if(aqi <= 150) return 'Вредно для чувствительных групп: астматики, дети, пожилые. Остальным — умеренная активность.';
    if(aqi <= 200) return 'Вредно для всех. Ограничьте продолжительное пребывание на улице, носите маску N95.';
    if(aqi <= 300) return 'Очень вредно. Оставайтесь в помещении, закройте окна, используйте очиститель воздуха.';
    return 'Опасно. Санитарное предупреждение — избегайте улицы. Используйте N95, очиститель воздуха.';
  } else {
    if(aqi <=  50) return 'Air quality is good. Outdoor activities are safe for everyone.';
    if(aqi <= 100) return 'Acceptable. Sensitive individuals should limit prolonged outdoor exertion.';
    if(aqi <= 150) return 'Unhealthy for sensitive groups: asthmatics, children, elderly. Others may continue normally.';
    if(aqi <= 200) return 'Unhealthy for all. Limit prolonged outdoor exposure. Consider wearing an N95 mask.';
    if(aqi <= 300) return 'Very unhealthy. Stay indoors, close windows, use an air purifier.';
    return 'Hazardous. Health alert — avoid going outside. Use N95 mask and air purifier.';
  }
}

/* ── Alert Modal ─────────────────────────────────────────── */

function openAlertModal(o){
  const modal = document.getElementById('alertModal');
  if(!modal) return;

  const isRu = LANG === 'ru';
  const hasCtx = o != null;
  const disName = hasCtx ? diseaseName(o) : '';

  // Fill context labels
  const sub = modal.querySelector('#alertModalSub');
  if(sub) sub.textContent = hasCtx ? `${disName} · ${o.country}` : (isRu ? 'Глобальный мониторинг' : 'Global monitoring');

  const ctryName = modal.querySelector('#alertTierCountryName');
  if(ctryName) ctryName.textContent = hasCtx
    ? (isRu ? `По стране: ${o.country}` : `By country: ${o.country}`)
    : (isRu ? 'По стране' : 'By country');

  const specName = modal.querySelector('#alertTierSpecificName');
  if(specName) specName.textContent = hasCtx
    ? (isRu ? `Точный алерт: ${disName}` : `Specific alert: ${disName}`)
    : (isRu ? 'Точный алерт' : 'Specific alert');

  // Store context on form for submission
  const form = modal.querySelector('#alertModalForm');
  if(form){
    form.dataset.outbreak = hasCtx ? o.id : '';
    form.dataset.country  = hasCtx ? o.country : '';
    form.dataset.disease  = disName;
  }

  // Default tier: global when no context, country otherwise
  const defaultTier = hasCtx ? 'country' : 'global';
  const defaultRadio = modal.querySelector(`input[value="${defaultTier}"]`);
  if(defaultRadio) defaultRadio.checked = true;
  modal.querySelectorAll('.alert-tier').forEach(el => {
    el.classList.toggle('is-selected', el.querySelector('input')?.value === defaultTier);
  });

  // Reset form state
  const emailInput = modal.querySelector('#alertModalEmail');
  if(emailInput) emailInput.value = '';
  const ok = modal.querySelector('#alertModalOk');
  if(ok) ok.style.display = 'none';
  if(form) form.style.display = '';

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => modal.classList.add('is-open'), 10);
  emailInput?.focus();
}

function closeAlertModal(){
  const modal = document.getElementById('alertModal');
  if(!modal) return;
  modal.classList.remove('is-open');
  setTimeout(() => { modal.style.display = 'none'; document.body.style.overflow = ''; }, 220);
}

window.closeAlertModal = closeAlertModal;

async function _submitAlertModal(e){
  e.preventDefault();
  const form  = e.currentTarget;
  const email = form.querySelector('#alertModalEmail')?.value?.trim();
  if(!email) return;

  const tier     = form.closest('#alertModal')?.querySelector('input[name="alertTier"]:checked')?.value || 'country';
  const country  = form.dataset.country  || '';
  const outbreak = form.dataset.outbreak || '';
  const disease  = form.dataset.disease  || '';

  const btn = form.querySelector('button[type="submit"]');
  if(btn){ btn.disabled = true; btn.textContent = LANG === 'ru' ? 'Подождите…' : 'Sending…'; }

  try {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tier, country, outbreak, disease, lang: LANG }),
    });
  } catch(_){ /* Netlify form fallback */ }

  form.style.display = 'none';
  const ok = form.closest('#alertModal')?.querySelector('#alertModalOk');
  if(ok) ok.style.display = 'block';
  if(btn){ btn.disabled = false; }
}

const SEV_COLOR_EXPR = ['match', ['get','sev'],
  'monitoring',   '#A09F95',
  'low',          '#E4B514',
  'warning',      '#E8590C',
  'alert',        '#C92A2A',
  'critical',     '#8B1A1A',
  'catastrophic', '#5C2010',
  '#888'
];

/* Theme-aware Mapbox styling. The interface theme lives on
   <html data-theme>; the globe must follow it. setStyle() wipes all custom
   sources/layers, so on every style load we re-apply fog and (after the
   initial load) re-add the markers + choropleth. */
function isDarkTheme(){
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
function mapStyleUrl(){
  return isDarkTheme()
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11';
}
function applyFog(){
  if(!map) return;
  if(isDarkTheme()){
    map.setFog({
      color:           'rgb(20, 22, 27)',
      'high-color':    'rgb(36, 40, 52)',
      'horizon-blend': 0.08,
      'space-color':   'rgb(11, 12, 15)',
      'star-intensity': 0.18,
    });
  } else {
    map.setFog({
      color:           'rgb(244, 242, 238)',
      'high-color':    'rgb(220, 220, 220)',
      'horizon-blend': 0.06,
      'space-color':   'rgb(244, 242, 238)',
      'star-intensity': 0,
    });
  }
}
/* Switch the globe between light/dark. Called by toggleTheme(). */
function setMapTheme(){
  if(!map) return;
  map.setStyle(mapStyleUrl());   // 'style.load' re-applies fog + layers
}

/* Topbar toggle: flip interface theme, persist the choice, follow on the globe.
   Exposed globally (onclick="toggleTheme()"). */
function toggleTheme(){
  const root = document.documentElement;
  const dark = root.getAttribute('data-theme') !== 'dark';
  if(dark) root.setAttribute('data-theme','dark');
  else     root.removeAttribute('data-theme');
  try{ localStorage.setItem('vigilo-theme', dark ? 'dark' : 'light'); }catch(e){}
  // Keep the mobile browser chrome colour in sync.
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', dark ? '#141310' : '#E8590C');
  setMapTheme();
}
window.toggleTheme = toggleTheme;

/* Share menu — context-aware (selected country → /app?c=ISO, else global view).
   Extends the viral loop into the app. X / LinkedIn / Copy. */
function openShareMenu(ev){
  if(ev) ev.stopPropagation();
  const old = document.getElementById('shareMenu');
  if(old){ old.remove(); return; }                 // toggle
  const tr = (en,ru)=> (typeof TR==='function'?TR(en,ru):en);
  const sel = (typeof state!=='undefined') && state.selectedCountry;
  let url, text;
  if(sel){
    const meta = findCountry(sel);
    const iso2 = ((meta && meta.iso2) || '').toUpperCase();
    url = location.origin + '/app' + (iso2 ? ('?c='+iso2) : '');
    const ri = iso2 && RISK_INDEX[iso2];
    const band = ri && ri.composite_risk && ri.composite_risk.band;
    text = tr(`${countryName(sel)} risk on Vigilo${band?' — '+band:''}. Live, source-traceable risk intelligence.`,
              `Риск: ${countryName(sel)} на Vigilo${band?' — '+band:''}. Живой, source-traceable.`);
  } else {
    url = location.origin + '/app';
    text = tr('Live global risk intelligence on Vigilo — 7 domains, source-traceable.',
              'Живой глобальный risk-intelligence на Vigilo — 7 доменов, source-traceable.');
  }
  const X='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-7-6.2 7H1.4l8.2-9.3L1 2h7l4.9 6.5L18.9 2zm-1.2 18h1.9L7.2 4H5.2l12.5 16z"/></svg>';
  const L='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>';
  const C='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const btn = document.getElementById('shareBtn');
  const r = btn ? btn.getBoundingClientRect() : {bottom:56,right:innerWidth-20};
  const m = document.createElement('div');
  m.id = 'shareMenu';
  m.style.cssText = `position:fixed;top:${r.bottom+8}px;right:${Math.max(12, innerWidth - r.right)}px;z-index:10001;background:var(--bg-card,#fff);border:1px solid var(--line,#eee);border-radius:12px;box-shadow:0 18px 50px -16px rgba(0,0,0,.35);padding:6px;min-width:190px`;
  const it=(lbl,svg)=>`<button class="sm-item" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;padding:9px 11px;border-radius:8px;font:inherit;font-size:13.5px;color:var(--ink);cursor:pointer">${svg}<span>${lbl}</span></button>`;
  m.innerHTML =
    `<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:6px 11px 4px">${sel?countryName(sel):tr('Global view','Глобальный вид')}</div>`+
    it(tr('Share on X','Поделиться в X'), X)+
    it(tr('Share on LinkedIn','В LinkedIn'), L)+
    it('<span id="smCopy">'+tr('Copy link','Копировать ссылку')+'</span>', C);
  document.body.appendChild(m);
  const items = m.querySelectorAll('.sm-item');
  const track=(net)=>{ try{ if(window.track) track('app_share',{net:net,ctx:sel?'country':'global'}); }catch(e){} };
  items[0].onclick=()=>{ track('x'); open('https://twitter.com/intent/tweet?text='+encodeURIComponent(text)+'&url='+encodeURIComponent(url),'_blank','noopener'); m.remove(); };
  items[1].onclick=()=>{ track('linkedin'); open('https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(url),'_blank','noopener'); m.remove(); };
  items[2].onclick=()=>{ track('copy'); try{navigator.clipboard.writeText(url); document.getElementById('smCopy').textContent=tr('Copied!','Скопировано!'); setTimeout(()=>m.remove(),900);}catch(e){ m.remove(); } };
  items.forEach(b=>{ b.onmouseenter=()=>b.style.background='var(--hover-bg,#f3f1ea)'; b.onmouseleave=()=>b.style.background='none'; });
  setTimeout(()=>{ const close=(e)=>{ if(!m.contains(e.target) && e.target.id!=='shareBtn'){ m.remove(); document.removeEventListener('click',close); } }; document.addEventListener('click',close); }, 0);
}
window.openShareMenu = openShareMenu;

/* Help menu — replaces the cryptic "?" → restart-tour. A proper help popover:
   tour, how-it-works, methodology, feedback. */
function openHelpMenu(ev){
  if(ev) ev.stopPropagation();
  const old = document.getElementById('helpMenu');
  if(old){ old.remove(); return; }
  const tr = (en,ru)=> (typeof TR==='function'?TR(en,ru):en);
  const I = {
    tour:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>',
    hiw:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 2.5"/><line x1="12" y1="17" x2="12" y2="17"/></svg>',
    meth:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>',
    fb:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  };
  const btn = document.getElementById('tourBtn');
  const r = btn ? btn.getBoundingClientRect() : {bottom:56,right:innerWidth-60};
  const m = document.createElement('div');
  m.id = 'helpMenu';
  m.style.cssText = `position:fixed;top:${r.bottom+8}px;right:${Math.max(12, innerWidth - r.right)}px;z-index:10001;background:var(--bg-card,#fff);border:1px solid var(--line,#eee);border-radius:12px;box-shadow:0 18px 50px -16px rgba(0,0,0,.35);padding:6px;min-width:210px`;
  const it=(lbl,svg)=>`<button class="hm-item" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;padding:9px 11px;border-radius:8px;font:inherit;font-size:13.5px;color:var(--ink);cursor:pointer">${svg}<span>${lbl}</span></button>`;
  m.innerHTML =
    `<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:6px 11px 4px">${tr('Help','Помощь')}</div>`+
    it(tr('Take the 30-sec tour','Пройти тур (30 сек)'), I.tour)+
    it(tr('How it works','Как это работает'), I.hiw)+
    it(tr('Methodology','Методология'), I.meth)+
    `<div style="height:1px;background:var(--line);margin:5px 8px"></div>`+
    it(tr('Send feedback','Оставить отзыв'), I.fb);
  document.body.appendChild(m);
  const items = m.querySelectorAll('.hm-item');
  items[0].onclick=()=>{ try{localStorage.removeItem('vigilo_app_onboarding_done');}catch(e){} location.reload(); };
  items[1].onclick=()=>{ location.href='/how-it-works'; };
  items[2].onclick=()=>{ window.open('/methodology','_blank','noopener'); m.remove(); };
  items[3].onclick=()=>{ m.remove(); openAppFeedback(); };
  items.forEach(b=>{ b.onmouseenter=()=>b.style.background='var(--hover-bg,#f3f1ea)'; b.onmouseleave=()=>b.style.background='none'; });
  setTimeout(()=>{ const close=(e)=>{ if(!m.contains(e.target) && e.target.id!=='tourBtn'){ m.remove(); document.removeEventListener('click',close); } }; document.addEventListener('click',close); }, 0);
}
window.openHelpMenu = openHelpMenu;

/* Minimal in-app feedback → /api/feedback (same endpoint as the cabinet). */
function openAppFeedback(){
  const tr = (en,ru)=> (typeof TR==='function'?TR(en,ru):en);
  const ov = document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:10002;background:rgba(13,14,18,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick = e => { if(e.target===ov) ov.remove(); };
  ov.innerHTML = `<div style="background:var(--bg-card,#fff);width:100%;max-width:420px;border-radius:16px;padding:24px;box-shadow:0 30px 80px -20px rgba(13,14,18,.5)">
    <h2 style="font-size:18px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;color:var(--ink)">${tr('Send feedback','Оставить отзыв')}</h2>
    <p style="font-size:13px;color:var(--muted);margin:0 0 14px">${tr("Bugs, ideas, what's missing — goes straight to the team.","Баги, идеи, чего не хватает — напрямую команде.")}</p>
    <textarea id="afbText" rows="4" placeholder="${tr("What's on your mind?",'Что думаете?')}" style="width:100%;padding:11px 13px;border:1.5px solid var(--line);border-radius:10px;font:inherit;font-size:14px;resize:vertical;outline:none;background:var(--bg-card);color:var(--ink)"></textarea>
    <div id="afbMsg" style="font-size:12.5px;margin-top:8px;min-height:16px"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
      <button id="afbCancel" style="background:none;border:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer">${tr('Cancel','Отмена')}</button>
      <button id="afbSend" style="background:var(--accent,#E8590C);color:#fff;border:none;border-radius:10px;padding:10px 18px;font:inherit;font-size:14px;font-weight:700;cursor:pointer">${tr('Send','Отправить')}</button>
    </div></div>`;
  document.body.appendChild(ov);
  const txt = ov.querySelector('#afbText'); txt.focus();
  ov.querySelector('#afbCancel').onclick = ()=> ov.remove();
  ov.querySelector('#afbSend').onclick = async ()=>{
    const message = txt.value.trim();
    const msg = ov.querySelector('#afbMsg');
    if(message.length < 3){ msg.style.color='var(--s3,#C92A2A)'; msg.textContent=tr('Add a little more.','Добавьте чуть больше.'); return; }
    const btn = ov.querySelector('#afbSend'); btn.disabled=true; btn.style.opacity='.6';
    try{
      await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,email:'',page:'app'})});
      ov.querySelector('div').innerHTML='<div style="text-align:center;padding:8px 0"><div style="font-size:17px;font-weight:800;color:var(--online,#19A463);margin-bottom:6px">'+tr('Thank you','Спасибо')+'</div><div style="font-size:13.5px;color:var(--muted)">'+tr('We read every message.','Читаем каждое сообщение.')+'</div></div>';
      setTimeout(()=>ov.remove(),1400);
    }catch(e){ btn.disabled=false; btn.style.opacity='1'; msg.style.color='var(--s3,#C92A2A)'; msg.textContent=tr('Could not send. Try again.','Не удалось. Попробуйте ещё.'); }
  };
}
window.openAppFeedback = openAppFeedback;

/* Deep-link: /app?c=ISO (or ?country=Name) opens that country on load.
   Enables "share this view" — a shared country link lands on it. */
function openDeepLinkCountry(){
  try{
    const q = new URLSearchParams(location.search);
    let name = q.get('country');
    const iso = q.get('c');
    if(!name && iso){
      const c = (typeof COUNTRY_BY_ISO2 !== 'undefined') && COUNTRY_BY_ISO2[iso.toUpperCase()];
      if(c) name = c.en;
    }
    if(name) setTimeout(() => { try{ selectCountry(name); }catch(e){} }, 400);
  }catch(e){}
}

function initMap(){
  map = new mapboxgl.Map({
    container: 'globe',
    style: mapStyleUrl(),
    projection: 'globe',
    center: [22, 8],
    zoom: 1.4,
    minZoom: 0.5,
    maxZoom: 8,
    attributionControl: false,
    pitchWithRotate: false,
    dragRotate: false,
  });
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

  map.on('error', (e) => {
    console.error('[Vigilo] Mapbox error:', e.error?.message || e);
  });

  map.on('style.load', () => {
    // Atmosphere matches the active theme (pale in light, deep space in dark).
    applyFog();
    // On a style SWITCH (theme toggle) the 'load' event does not fire again,
    // so re-add our custom sources/layers here. On the initial load these are
    // skipped (guarded by _mapLoadedOnce) because 'load' below handles them.
    if(_mapLoadedOnce){
      addGLMarkers();
      refreshCountryRiskFill();
      if(state.cats.air) showAQILayer(true);
    }
  });

  map.on('load', () => {
    _mapLoadedOnce = true;
    addGLMarkers();
    refreshCountryRiskFill();           // country-level choropleth (if RI loaded)
    map.on('move', positionPopup);
    map.on('zoom', () => { positionPopup(); updateClock(); });
    map.on('resize', positionPopup);
    updateClock();
    if(state.cats.air) showAQILayer(true);
    openDeepLinkCountry();   // ?c=ISO or ?country=Name → open that country
  });

  // Click on empty map → deselect (skip if a marker layer just handled it)
  map.on('click', () => {
    if(_markerClicked){ _markerClicked = false; return; }
    deselect();
  });

  // Popup close button
  document.getElementById('popClose')?.addEventListener('click', (e) => {
    e.stopPropagation();
    deselect();
  });

  // List-view detail drawer: close on backdrop click, panel ×, or Esc.
  // Delegated on #panel because panel-scroll (which contains the × button)
  // is re-rendered, so a direct handler would be lost.
  document.getElementById('listDetailBack')?.addEventListener('click', deselect);
  document.getElementById('panel')?.addEventListener('click', (e) => {
    if(e.target.closest('.panel-eyebrow .x')){ e.stopPropagation(); deselect(); }
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && typeof APP !== 'undefined' && APP.classList.contains('detail-open')) deselect();
  });
}

/* Country-level risk choropleth — fixes the "huge country, one dot" problem
   (e.g. Russia). Fills each country polygon by composite risk band from
   RISK_INDEX. Defensive: silently no-ops if RISK_INDEX empty or style not
   ready. Insert BELOW the marker layers so dots render on top. */
function refreshCountryRiskFill(){
  if(!map) return;
  if(!map.isStyleLoaded()){ map.once('idle', refreshCountryRiskFill); return; }
  if(!Object.keys(RISK_INDEX || {}).length) return;

  if(!map.getSource('country-boundaries')){
    map.addSource('country-boundaries', {
      type: 'vector',
      url: 'mapbox://mapbox.country-boundaries-v1',
    });
  }

  const matchExpr = ['match', ['get', 'iso_3166_1']];
  let added = 0;
  for(const [iso, ri] of Object.entries(RISK_INDEX)){
    const band = ri?.composite_risk?.band;
    let color = null;
    if(band === 'critical' || band === 'severe')      color = '#C92A2A';
    else if(band === 'high' || band === 'elevated')   color = '#E8590C';
    else if(band === 'moderate')                       color = '#E4B514';
    else if(band === 'low' || band === 'minimal')     color = '#19A463';
    if(color){ matchExpr.push(iso, color); added++; }
  }
  if(!added) return;
  matchExpr.push('rgba(0,0,0,0)'); // unranked → transparent

  if(map.getLayer('country-risk-fill')){
    map.setPaintProperty('country-risk-fill', 'fill-color', matchExpr);
    return;
  }
  // Place fill BELOW marker layers so dots render on top
  const layers = map.getStyle().layers || [];
  const firstMarker = layers.find(l => l.id && l.id.startsWith('outbreaks-'));
  const beforeId = firstMarker ? firstMarker.id : undefined;
  map.addLayer({
    id: 'country-risk-fill',
    type: 'fill',
    source: 'country-boundaries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': matchExpr,
      'fill-opacity': 0.10,        // soft tint — labels and dots stay primary
      'fill-antialias': true,
    },
  }, beforeId);

  // Hover highlight — soft fill bump + thin outline on the country under the
  // cursor. Filtered to the hovered ISO; mousemove updates it. Placed just
  // above the risk fill, still below markers.
  // Hover ink follows the theme: dark ink on a light globe, light on a dark one.
  const hoverInk = isDarkTheme() ? '#FFFFFF' : '#14110C';
  if(!map.getLayer('country-hover-fill')){
    map.addLayer({
      id: 'country-hover-fill', type: 'fill',
      source: 'country-boundaries', 'source-layer': 'country_boundaries',
      filter: ['==', ['get','iso_3166_1'], '__none__'],
      paint: { 'fill-color': hoverInk, 'fill-opacity': isDarkTheme() ? 0.12 : 0.07 },
    }, beforeId);
  }
  if(!map.getLayer('country-hover-line')){
    map.addLayer({
      id: 'country-hover-line', type: 'line',
      source: 'country-boundaries', 'source-layer': 'country_boundaries',
      filter: ['==', ['get','iso_3166_1'], '__none__'],
      paint: { 'line-color': hoverInk, 'line-width': 1.2, 'line-opacity': isDarkTheme() ? 0.45 : 0.35 },
    }, beforeId);
  }

  // Click anywhere on a country polygon → open that country's panel.
  // Markers (events) take precedence: if a dot is under the cursor we let
  // its handler win. Bound once (this fn re-runs on every data refresh).
  if(!_countryClickBound){
    _countryClickBound = true;
    map.on('click', 'country-risk-fill', (e) => {
      const markerLayers = ['outbreaks-dot','outbreaks-halo','outbreaks-halo-mid']
        .filter(l => map.getLayer(l));
      const hitMarker = markerLayers.length
        && map.queryRenderedFeatures(e.point, { layers: markerLayers }).length;
      if(hitMarker) return;                       // marker click wins
      const f = e.features && e.features[0];
      const iso2 = f && f.properties && f.properties.iso_3166_1;
      if(!iso2) return;
      const c = COUNTRY_BY_ISO2[iso2.toUpperCase()];
      const name = c ? c.en : (f.properties.name_en || iso2);
      _markerClicked = true;                      // suppress generic deselect
      selectCountry(name);
    });
    const setHover = (iso) => {
      const filt = ['==', ['get','iso_3166_1'], iso || '__none__'];
      if(map.getLayer('country-hover-fill')) map.setFilter('country-hover-fill', filt);
      if(map.getLayer('country-hover-line')) map.setFilter('country-hover-line', filt);
    };
    map.on('mousemove', 'country-risk-fill', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features && e.features[0];
      setHover(f && f.properties && f.properties.iso_3166_1);
    });
    map.on('mouseleave', 'country-risk-fill', () => {
      map.getCanvas().style.cursor = '';
      setHover(null);
    });
  }
}

function buildGeoJSON(){
  return {
    type: 'FeatureCollection',
    features: OUTBREAKS
      .filter(o => { const lon = o.lon ?? o.lng; return typeof lon === 'number' && typeof o.lat === 'number'; })
      .map(o => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [o.lon ?? o.lng, o.lat] },
        properties: { id: o.id, sev: o.sev || 'monitoring', type: o.type || 'epidemic', cases: Number(o.cases) || 0 }
      }))
  };
}

function addGLMarkers(){
  if(!map) return;

  // If source already exists (e.g. live data refresh), just update data
  const existing = map.getSource('outbreaks');
  if(existing){ existing.setData(buildGeoJSON()); applyGLFilters(); return; }

  map.addSource('outbreaks', { type: 'geojson', data: buildGeoJSON() });

  // Gradient halo: 3 stacked rings for soft fade effect
  map.addLayer({
    id: 'outbreaks-halo-outer', type: 'circle', source: 'outbreaks',
    paint: {
      'circle-radius': ['case', ['==', ['get','type'],'air'], 40, 34],
      'circle-color': SEV_COLOR_EXPR,
      'circle-opacity': 0.06,
      'circle-stroke-width': 0,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    }
  });
  map.addLayer({
    id: 'outbreaks-halo-mid', type: 'circle', source: 'outbreaks',
    paint: {
      'circle-radius': ['case', ['==', ['get','type'],'air'], 28, 23],
      'circle-color': SEV_COLOR_EXPR,
      'circle-opacity': 0.13,
      'circle-stroke-width': 0,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    }
  });
  map.addLayer({
    id: 'outbreaks-halo', type: 'circle', source: 'outbreaks',
    paint: {
      'circle-radius': ['case', ['==', ['get','type'],'air'], 18, 15],
      'circle-color': SEV_COLOR_EXPR,
      'circle-opacity': 0.22,
      'circle-stroke-width': 0,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    }
  });

  // Inner dot
  map.addLayer({
    id: 'outbreaks-dot', type: 'circle', source: 'outbreaks',
    paint: {
      'circle-radius': ['case', ['==', ['get','type'],'air'], 9, 7],
      'circle-color': SEV_COLOR_EXPR,
      'circle-opacity': 1,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.8)',
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    }
  });

  // Selected halo
  map.addLayer({
    id: 'outbreaks-sel-halo', type: 'circle', source: 'outbreaks',
    filter: ['==', ['get','id'], ''],
    paint: {
      'circle-radius': ['case', ['==', ['get','type'],'air'], 32, 26],
      'circle-color': SEV_COLOR_EXPR,
      'circle-opacity': 0.40,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    }
  });

  // Selected dot (white border)
  map.addLayer({
    id: 'outbreaks-sel-dot', type: 'circle', source: 'outbreaks',
    filter: ['==', ['get','id'], ''],
    paint: {
      'circle-radius': ['case', ['==', ['get','type'],'air'], 11, 9],
      'circle-color': SEV_COLOR_EXPR,
      'circle-opacity': 1,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    }
  });

  // Bind to the big visible halos too — on mobile the 7px dot is an
  // impossible tap target; the soft circle around it must be tappable.
  ['outbreaks-dot','outbreaks-halo','outbreaks-halo-mid'].forEach(layer => {
    map.on('click', layer, (e) => {
      _markerClicked = true;
      selectOutbreak(e.features[0].properties.id);
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });

  applyGLFilters();
}

function applyGLFilters(){
  if(!map || !map.getLayer('outbreaks-halo')) return;

  const activeCats = Object.entries(state.cats).filter(([,v])=>v).map(([k])=>k);
  const catFilter = activeCats.length
    ? ['in', ['get','type'], ['literal', activeCats]]
    : ['boolean', false];

  const sevFilter = state.filter === 'all'
    ? ['boolean', true]
    : state.filter === 'warning'
      ? ['in', ['get','sev'], ['literal', ['warning','low']]]
      : ['==', ['get','sev'], state.filter];

  const baseFilter = ['all', catFilter, sevFilter];
  map.setFilter('outbreaks-halo-outer', baseFilter);
  map.setFilter('outbreaks-halo-mid',   baseFilter);
  map.setFilter('outbreaks-halo',       baseFilter);
  map.setFilter('outbreaks-dot',        baseFilter);

  const selId = state.selectedId || '';
  map.setFilter('outbreaks-sel-halo', ['all', ['==', ['get','id'], selId], catFilter, sevFilter]);
  map.setFilter('outbreaks-sel-dot',  ['all', ['==', ['get','id'], selId], catFilter, sevFilter]);
}

/* (Canvas rendering removed — Mapbox handles globe rendering & resize) */

/* =========================================================
   UTILITIES
   ========================================================= */
function hexA(h, a){
  const r = parseInt(h.slice(1,3),16);
  const g = parseInt(h.slice(3,5),16);
  const b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* =========================================================
   MARKERS — projection helper for popup placement
   ========================================================= */
function projectOutbreak(o){
  if(!map) return null;
  const lon = o.lon ?? o.lng;
  if(typeof lon !== 'number' || typeof o.lat !== 'number') return null;
  const p = map.project([lon, o.lat]);
  const rect = globeEl.getBoundingClientRect();
  const visible = p.x >= 0 && p.x <= rect.width && p.y >= 0 && p.y <= rect.height;
  return { x: p.x, y: p.y, visible };
}

/* =========================================================
   POPUP positioning
   ========================================================= */
const popup = document.getElementById('popup');
function positionPopup(){
  if(!popup) return;
  const sel = currentSel();
  if(!sel){ popup.classList.remove('is-on'); return; }
  const p = projectOutbreak(sel);
  if(!p || !p.visible){ popup.classList.remove('is-on'); return; }
  popup.classList.add('is-on');
  const w = popup.offsetWidth, h = popup.offsetHeight;
  const rect = globeEl.getBoundingClientRect();
  let x = p.x, y = p.y - 26;
  const pad = 16;
  if(x - w/2 < pad) x = w/2 + pad;
  if(x + w/2 > rect.width - pad) x = rect.width - pad - w/2;
  if(y - h < pad) y = p.y + h + 36;
  popup.style.left = x+'px';
  popup.style.top  = y+'px';
}

function updateClock(){
  if(!map) return;
  const c = map.getCenter();
  const z = map.getZoom();
  const latEl = document.getElementById('lat');
  const lonEl = document.getElementById('lon');
  const zoEl  = document.getElementById('zo');
  if(latEl) latEl.textContent = fmtDeg(c.lat, 'NS');
  if(lonEl) lonEl.textContent = fmtDeg(c.lng, 'EW');
  if(zoEl)  zoEl.textContent  = z.toFixed(2)+'×';
}
function fmtDeg(v, ax){
  const sign = v>=0 ? (ax[0]) : (ax[1]);
  return ` ${sign} ${Math.abs(v).toFixed(2)}°`;
}

/* =========================================================
   INTERACTIONS — drag/zoom/click are handled natively by Mapbox.
   Marker clicks are wired up in addGLMarkers() via map.on('click','outbreaks-dot').
   ========================================================= */
document.getElementById('zIn').onclick     = () => map && map.zoomIn();
document.getElementById('zOut').onclick    = () => map && map.zoomOut();
document.getElementById('zRecenter').onclick = () => {
  if(!map) return;
  const sel = currentSel();
  if(sel) flyTo(sel);
  else map.flyTo({ center: [22, 8], zoom: 1.4, duration: 900 });
};
const togRot = document.getElementById('togRot');
togRot.onclick = () => {
  // Auto-rotate not supported by Mapbox out-of-the-box — toggle is visual only.
  togRot.classList.toggle('is-on');
};

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* =========================================================
   SELECTION / UI BINDING
   ========================================================= */
function currentSel(){ return OUTBREAKS.find(o=>o.id===state.selectedId); }

function deselect(){
  state.selectedId = null;
  state.selectedCountry = null;
  if(popup) popup.classList.remove('is-on');
  if(typeof APP !== 'undefined' && APP) APP.classList.remove('detail-open');
  applyGLFilters();
  renderCatLists();
  renderList();
  document.getElementById('crumbsBar')?.style.setProperty('display','none');
}

function selectOutbreak(id){
  state.selectedId = id;
  const o = currentSel();
  if(!o) return;
  flyTo(o);
  renderList();
  renderPanel();
  renderPopup();
  applyGLFilters();
  renderCatLists();
  positionPopup();
  document.getElementById('crumbsBar')?.style.setProperty('display','flex');
  // In list view, show the detail as a drawer over the list instead of
  // forcing a jump to the globe.
  if(currentView === 'list' && typeof APP !== 'undefined' && APP) APP.classList.add('detail-open');
  if(window.innerWidth <= 768 && typeof window.mobOpenDetail === 'function') window.mobOpenDetail(false);
}

function flyTo(o){
  if(!o || !map) return;
  const lon = o.lon ?? o.lng;
  if(typeof lon !== 'number' || typeof o.lat !== 'number') return;
  map.flyTo({
    center: [lon, o.lat],
    zoom: Math.max(map.getZoom(), 3.2),
    speed: 1.4,
    curve: 1.4,
  });
}

function matchesQuery(o, q){
  if(!q) return true;
  const hay = [o.name, o.country, o.region, o.pathogen, o.code, o.place]
    .filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(word => hay.includes(word));
}

// Tracks which collapsed list-groups the user has expanded (persists across
// re-renders within a session). Keyed by the group key from listGroupKey().
const _listExpanded = new Set();

// Mode-aware group key. state.listGroup:
//   'none'    → keep only the food/allergen auto-collapse (anti-spam); rest solo
//   'country' → one group per country
//   'type'    → one group per domain (risk) / disease / allergen root
function listGroupKey(o){
  const mode = state.listGroup;
  if(mode === 'country') return 'C|' + (o.country || '?');
  if(mode === 'type'){
    if(o._risk) return 'T|' + (o._riskCat || o.type);
    if((o.type) === 'food') return 'Tf|' + String(diseaseName(o)).split('·')[0].trim();
    return 'T|' + diseaseName(o);
  }
  if((o.type) === 'food'){
    return `food|${o.country}|${String(diseaseName(o)).split('·')[0].trim()}`;
  }
  return `solo|${o.id}`;
}
function listGroupLabel(g){
  const mode = state.listGroup;
  const w = g.items[0];
  if(mode === 'country') return countryName(w.country) || w.country || '—';
  if(mode === 'type'){
    if(w._risk){ const dl = RISK_DOMAIN_LABEL[w._riskCat]; if(dl) return LANG==='ru'?dl.ru:dl.en; }
    return String(diseaseName(w)).split('·')[0].trim();
  }
  return String(diseaseName(w)).split('·')[0].trim();
}
function _eventTs(o){
  const t = Date.parse(o.first_seen || o.last_updated || o.detected_at || '');
  if(!isNaN(t)) return t;
  const m = String(o.code || '').match(/\d{4}-\d{2}-\d{2}/);
  return m ? Date.parse(m[0]) : 0;
}
function _eventWhen(o){
  const ts = _eventTs(o);
  if(!ts) return '';
  const h = (Date.now() - ts) / 3.6e6;
  if(h < 1)  return LANG==='ru' ? 'только что' : 'just now';
  if(h < 24) return Math.round(h) + (LANG==='ru' ? ' ч' : 'h');
  const d = Math.round(h / 24);
  if(d <= 30) return d + (LANG==='ru' ? ' дн' : 'd');
  return new Date(ts).toLocaleDateString(LANG==='ru' ? 'ru-RU' : 'en-GB',
                                          { day:'2-digit', month:'short' });
}
function _sortItems(arr){
  const a = arr.slice();
  if(state.listSort === 'az')
    a.sort((x,y)=> (shortTitle(x)||'').localeCompare(shortTitle(y)||''));
  else if(state.listSort === 'date')
    a.sort((x,y)=> _eventTs(y) - _eventTs(x));
  else
    a.sort((x,y)=> (SEV[y.sev]?.idx ?? 0) - (SEV[x.sev]?.idx ?? 0));  // severity
  return a;
}

function renderList(){
  const root = document.getElementById('list');
  const f = state.filter;
  const q = state.query;
  let items = f === 'all' ? OUTBREAKS : OUTBREAKS.filter(o => o.sev === f || (f==='warning' && o.sev==='low'));
  // Category filter
  items = items.filter(o => {
    const cat = o.type || 'epidemic';
    return state.cats[cat] !== false;
  });
  if(state.selectedCountry) items = items.filter(o => o.country === state.selectedCountry);
  items = items.filter(o => matchesQuery(o, q));
  document.getElementById('listCount').textContent = items.length;

  if(items.length === 0){
    const noMsg = q
      ? (LANG==='ru' ? `По запросу «${q}» ничего не найдено` : `No results for "${q}"`)
      : (LANG==='ru' ? 'Нет активных угроз в этой категории' : 'No active threats in this category');
    root.innerHTML = `<div style="padding:24px 12px;text-align:center;color:var(--muted);font-size:12px;line-height:1.6;">${noMsg}</div>`;
    return;
  }

  const sevLabels = {
    catastrophic: LANG==='ru'?'Катастр.':'Catastr.',
    critical: LANG==='ru'?'Крит.':'Critical',
    severe:   LANG==='ru'?'Высок.':'Severe',
    alert:    LANG==='ru'?'Алерт':'Alert',
    elevated: LANG==='ru'?'Повыш.':'Elevated',
    warning:  LANG==='ru'?'Средн.':'Warning',
    moderate: LANG==='ru'?'Умер.':'Moderate',
    monitoring: LANG==='ru'?'Низк.':'Monitor',
    low:      LANG==='ru'?'Низк.':'Low',
    minimal:  LANG==='ru'?'Миним.':'Minimal',
  };
  const sevLbl = (s) => sevLabels[s] || s;
  const sevTagStyle = (sev) => {
    const c = SEV[sev]?.color || '#888';
    return `background:${hexA(c,0.12)};color:${c};`;
  };
  // ── Sort, then group per the active mode ──
  items = _sortItems(items);
  const groups = [];
  const byKey = new Map();
  for(const o of items){
    const key = listGroupKey(o);
    let g = byKey.get(key);
    if(!g){ g = { key, items: [] }; byKey.set(key, g); groups.push(g); }
    g.items.push(o);
  }

  const card = (o) => {
    const sev = SEV[o.sev] || SEV.warning;
    const cat = o.type || 'epidemic';
    const catColor = (CATEGORY_META[cat]?.color) || sev.color;
    // Risk events: short localised label + small headline. Epidemics: name + case stats.
    const body = o._risk
      ? `<div class="name">${escapeAttr(shortTitle(o))}</div>
         <div class="ev-headline">${escapeAttr(fullHeadline(o))}</div>`
      : `<div class="name">${diseaseName(o)}</div>
         <div class="stats">
           <div class="stat"><div class="v">${fmtNum(o.cases)}</div><div class="k">${T('cases')}</div></div>
           <div class="stat"><div class="v ${o.deaths?'red':''}">${o.deaths?fmtNum(o.deaths):'—'}</div><div class="k">${T('deaths')||(LANG==='ru'?'смертей':'deaths')}</div></div>
         </div>`;
    return `
    <article class="ev-card ${o.id===state.selectedId?'is-selected':''}" data-id="${o.id}">
      <div class="top">
        <span class="country"><span class="dot" style="background:${catColor}"></span>${countryName(o.country)||'—'}</span>
        <span class="sev-tag" style="${sevTagStyle(o.sev)}">${sevLabels[o.sev]||o.sev}</span>
      </div>
      ${body}
    </article>`;
  };

  const grouped = state.listGroup !== 'none';
  root.classList.toggle('is-grouped', grouped);

  if(!grouped){
    // ── Flat card grid (with food/allergen auto-collapse) ──
    root.innerHTML = groups.map(g => {
      if(g.items.length === 1) return card(g.items[0]);
      const worst = g.items.reduce((a,b)=> (SEV[b.sev]?.idx||0)>(SEV[a.sev]?.idx||0)?b:a, g.items[0]);
      const cat = worst.type || 'epidemic';
      const catColor = (CATEGORY_META[cat]?.color) || (SEV[worst.sev]||SEV.warning).color;
      const label = listGroupLabel(g), n = g.items.length;
      const isOpen = _listExpanded.has(g.key);
      const childCards = isOpen ? `<div class="ev-group-children">${g.items.map(card).join('')}</div>` : '';
      return `
      <article class="ev-card ev-group ${isOpen?'is-open':''}" data-group="${escapeAttr(g.key)}">
        <div class="top">
          <span class="country"><span class="dot" style="background:${catColor}"></span>${escapeAttr(label)}</span>
          <span class="sev-tag" style="${sevTagStyle(worst.sev)}">${sevLbl(worst.sev)}</span>
        </div>
        <div class="name"><span class="ev-count">×${n}</span></div>
        <div class="ev-group-hint">${isOpen?(LANG==='ru'?'Свернуть ▴':'Collapse ▴'):(LANG==='ru'?`Показать ${n} ▾`:`Show ${n} ▾`)}</div>
      </article>${childCards}`;
    }).join('');
  } else {
    // ── Compact accordion (group by country / type) ──
    const rowSub = (o) => o._risk ? fullHeadline(o)
                        : (o.cases ? `${fmtNum(o.cases)} ${T('cases')}` : countryName(o.country) || '');
    root.innerHTML = groups.map(g => {
      const worst = g.items.reduce((a,b)=> (SEV[b.sev]?.idx||0)>(SEV[a.sev]?.idx||0)?b:a, g.items[0]);
      const catColor = (CATEGORY_META[worst.type||'epidemic']?.color) || (SEV[worst.sev]||SEV.warning).color;
      const label = listGroupLabel(g), n = g.items.length;
      const isOpen = _listExpanded.has(g.key);
      const sevC = (SEV[worst.sev]||SEV.warning).color;
      const rows = g.items.map(o => {
        const title = o._risk ? (fullHeadline(o) || shortTitle(o)) : diseaseName(o);
        const when  = _eventWhen(o);
        const ctry  = countryName(o.country) || o.country || '';
        const meta  = [ctry, when].filter(Boolean).join(' · ');
        return `
        <button class="lrow ${o.id===state.selectedId?'is-selected':''}" data-id="${o.id}">
          <span class="lrow-sev" style="background:${(SEV[o.sev]||SEV.warning).color}"></span>
          <span class="lrow-main">
            <span class="lrow-title">${escapeAttr(title)}</span>
            ${meta ? `<span class="lrow-meta">${escapeAttr(meta)}</span>` : ''}
          </span>
          <span class="lrow-sub">${escapeAttr(sevLbl(o.sev))}</span>
        </button>`;
      }).join('');
      return `
      <div class="lgrp ${isOpen?'open':''}" data-group="${escapeAttr(g.key)}">
        <div class="lgrp-head">
          <span class="lgrp-dot" style="background:${catColor}"></span>
          <span class="lgrp-label">${escapeAttr(label)}</span>
          <span class="lgrp-count">×${n}</span>
          <span class="lgrp-sev" style="${sevTagStyle(worst.sev)}">${sevLbl(worst.sev)}</span>
          <span class="lgrp-chev">▾</span>
        </div>
        ${isOpen ? `<div class="lgrp-body">${rows}</div>` : ''}
      </div>`;
    }).join('');
  }

  // Card / row → open event
  root.querySelectorAll('[data-id]').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.stopPropagation(); selectOutbreak(el.dataset.id); });
    el.addEventListener('mouseenter', ()=>{ state.hoveredId = el.dataset.id; });
    el.addEventListener('mouseleave', ()=>{ state.hoveredId = null; });
  });
  // Group headers (grid card OR accordion head) → toggle expand
  root.querySelectorAll('.ev-card.ev-group[data-group], .lgrp[data-group] .lgrp-head').forEach(el=>{
    el.addEventListener('click', ()=>{
      const host = el.closest('[data-group]');
      const k = host.dataset.group;
      if(_listExpanded.has(k)) _listExpanded.delete(k); else _listExpanded.add(k);
      renderList();
    });
  });
}

function sevClass(s){ return 's' + SEV[s].idx; }
function fmtNum(n){
  if(n == null || isNaN(n)) return '—';
  if(n>=1_000_000) return (n/1_000_000).toFixed(n>=10_000_000?0:1)+'M';
  if(n>=1000) return (n/1000).toFixed(n>=10_000?0:1)+'k';
  return Number(n).toLocaleString();
}

// Cache the original detail-panel markup so renderPanelEmpty can swap to empty state
// without destroying the static HTML that renderPanel() relies on (panEy, panName, etc.).
let _panelDetailHTML = null;
function renderPanelEmpty(){
  const ps = document.querySelector('.panel-scroll');
  if(!ps) return;
  if(_panelDetailHTML === null) _panelDetailHTML = ps.innerHTML;
  const critical = OUTBREAKS.filter(o=>o.sev==='critical'||o.sev==='alert').length;
  ps.innerHTML = `
    <div style="padding:32px 20px 24px; text-align:center;">
      <div style="font-size:17px; font-weight:800; letter-spacing:-0.03em; margin-bottom:6px;">${LANG==='ru'?'Глобальный мониторинг':'Global Surveillance'}</div>
      <div style="font-size:12.5px; color:var(--muted); line-height:1.5; margin-bottom:20px;">${LANG==='ru'?`Отслеживается <b style="color:var(--ink)">${OUTBREAKS.filter(o=>o.type!=='air'&&o.type!=='food'&&o.type!=='humanitarian').length}</b> вспышек · <b style="color:var(--s3)">${critical}</b> критических`:`Tracking <b style="color:var(--ink)">${OUTBREAKS.filter(o=>o.type!=='air'&&o.type!=='food'&&o.type!=='humanitarian').length}</b> outbreaks · <b style="color:var(--s3)">${critical}</b> critical`}</div>
      <div style="font-size:11px; color:var(--muted-2); margin-bottom:16px;">${LANG==='ru'?'Нажмите на маркер на глобусе или выберите вспышку из списка':'Click a marker on the globe or select an outbreak from the list'}</div>
      <div style="background:rgba(232,89,12,0.07); border:1px solid rgba(232,89,12,0.18); border-radius:var(--r-md); padding:12px 14px; text-align:left;">
        <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--accent); margin-bottom:8px;">${LANG==='ru'?'Проверить страну':'Check a country'}</div>
        <div style="font-size:12px; color:var(--ink-2);">${LANG==='ru'?'Используйте поиск по стране слева — получите сводку угроз и рекомендации по безопасности':'Use the country search on the left to get a threat summary and travel safety recommendations'}</div>
      </div>
    </div>`;
}

// ── Health Weather ────────────────────────────────────────────
function aqiInfo(v){
  if(v==null) return null;
  if(v<=50)  return {label:`Good · ${v}`,       cls:'hw-good'};
  if(v<=100) return {label:`Moderate · ${v}`,   cls:'hw-moderate'};
  if(v<=150) return {label:`Sensitive · ${v}`,  cls:'hw-unhealthy'};
  if(v<=200) return {label:`Unhealthy · ${v}`,  cls:'hw-unhealthy'};
  return            {label:`Hazardous · ${v}`,  cls:'hw-hazardous'};
}

function pollenInfo(val){
  if(!val || val<=0) return null;
  if(val<10)  return {label:LANG==='ru'?'Низкая':'Low',          cls:'hw-good'};
  if(val<30)  return {label:LANG==='ru'?'Умеренная':'Moderate',  cls:'hw-moderate'};
  if(val<70)  return {label:LANG==='ru'?'Высокая':'High',        cls:'hw-unhealthy'};
  return             {label:LANG==='ru'?'Очень высокая':'Very high', cls:'hw-hazardous'};
}

function fluLevelFromEvents(country){
  const FLU_RE = /\b(influenza|flu|h\d+n\d+|grippe|грипп|ОРВИ)\b/i;
  const matches = OUTBREAKS.filter(o =>
    o.country===country && FLU_RE.test(o.name||o.disease||'')
  );
  if(!matches.length) return null;
  const worst = matches.sort((a,b)=>b.sevIdx-a.sevIdx)[0];
  const MAP = {
    critical:   {label:LANG==='ru'?'Высокая':'High',       cls:'hw-hazardous'},
    alert:      {label:LANG==='ru'?'Повышенная':'Elevated', cls:'hw-unhealthy'},
    warning:    {label:LANG==='ru'?'Умеренная':'Moderate',  cls:'hw-moderate'},
    monitoring: {label:LANG==='ru'?'Низкая':'Low',          cls:'hw-good'},
    low:        {label:LANG==='ru'?'Фоновая':'Baseline',    cls:'hw-good'},
  };
  return MAP[worst.sev]||null;
}

async function loadHealthWeather(lat, lon, country){
  const el = document.getElementById('hwContent');
  if(!el) return;
  el.innerHTML = `<span class="hw-loading">${LANG==='ru'?'загрузка…':'loading…'}</span>`;

  let aqi=null, pollen=null;
  try{
    const vars = 'us_aqi,grass_pollen,birch_pollen,mugwort_pollen';
    const r = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=${vars}`
    );
    if(r.ok){
      const d = await r.json();
      const cur = d.current||{};
      aqi = aqiInfo(cur.us_aqi!=null ? Math.round(cur.us_aqi) : null);
      const maxP = Math.max(cur.grass_pollen||0, cur.birch_pollen||0, cur.mugwort_pollen||0);
      pollen = pollenInfo(maxP>0 ? maxP : null);
    }
  }catch(_){}

  const flu = fluLevelFromEvents(country);
  const na  = `<span class="hw-na">${LANG==='ru'?'нет данных':'no data'}</span>`;
  const badge = info => info
    ? `<span class="hw-badge ${info.cls}">${info.label}</span>`
    : na;

  const aqiKey = LANG==='ru'?'Качество воздуха':'Air quality';
  const polKey = LANG==='ru'?'Пыльца':'Pollen';
  const fluKey = LANG==='ru'?'Активность гриппа':'Flu activity';

  el.innerHTML = `
    <div class="hw-row"><span class="hw-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M17.73 2.27A2.5 2.5 0 1 1 19.5 6.5H2"/><path d="M14.5 15.5A2.5 2.5 0 1 0 16.5 19H2"/></svg></span><span class="hw-key">${aqiKey}</span>${badge(aqi)}</div>
    <div class="hw-row"><span class="hw-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></span><span class="hw-key">${polKey}</span>${badge(pollen)}</div>
    <div class="hw-row"><span class="hw-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span><span class="hw-key">${fluKey}</span>${badge(flu)}</div>
  `;
}

function renderPanel(){
  const o = currentSel();
  if(!o){ renderPanelEmpty(); return; }
  // Restore the detail markup if a previous renderPanelEmpty replaced it
  const panelScroll = document.querySelector('.panel-scroll');
  if(panelScroll && _panelDetailHTML !== null && !document.getElementById('panEy')){
    panelScroll.innerHTML = _panelDetailHTML;
  }
  const sev = SEV[o.sev];
  const grad = `linear-gradient(160deg, ${sev.light}, ${sev.color} 55%, ${sev.dark})`;

  document.getElementById('panEy').textContent = `${T('outbreak')} · ${o.code}`;
  // Risk/news events: short localised label big + full headline small (was a
  // giant raw English headline). Epidemics keep their short disease name.
  if(o._risk){
    document.getElementById('panName').innerHTML =
      escapeAttr(shortTitle(o)) +
      `<div style="font-size:12.5px;font-weight:500;line-height:1.45;color:var(--muted,#807e76);margin-top:8px;letter-spacing:0">${escapeAttr(fullHeadline(o))}</div>`;
  } else {
    document.getElementById('panName').innerHTML = breakName(diseaseName(o));
  }
  document.getElementById('panLoc').textContent = `${countryName(o.place) || o.place} · ${regionName(o.region)}`;
  document.getElementById('panPin').style.background = sev.color;
  const ps = document.getElementById('panStatus');
  ps.style.background = grad;
  ps.style.boxShadow = `0 8px 20px -10px ${hexA(sev.color, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.14)`;
  ps.querySelector('.v').textContent = translateWho(o.who);

  // ── Risk events render through the health panel: relabel everything
  //    to risk-appropriate, localised copy (no medical metrics). ──
  const RISK_DOMAIN = {
    conflict:       { en:'Armed conflict',     ru:'Вооружённый конфликт' },
    civil_unrest:   { en:'Civil unrest',       ru:'Гражданские беспорядки' },
    transport:      { en:'Transport disruption', ru:'Сбой транспорта' },
    border:         { en:'Border / entry',     ru:'Границы и въезд' },
    infrastructure: { en:'Infrastructure',     ru:'Инфраструктура' },
    climate:        { en:'Natural disaster',   ru:'Стихийное бедствие' },
  };
  if (o._risk) {
    const dl  = RISK_DOMAIN[o._riskCat] || { en:'Risk event', ru:'Событие риска' };
    const lbl = LANG === 'ru' ? dl.ru : dl.en;
    document.getElementById('panEy').textContent =
      `${LANG === 'ru' ? 'Событие' : 'Event'} · ${lbl}`;
    document.getElementById('panLoc').textContent =
      `${countryName(o.place) || o.place} · ${lbl}`;
    const psl = ps.querySelector('.l');
    if (psl) psl.textContent = LANG === 'ru' ? 'Источник' : 'Source';
    const setMetric = (id, val, label) => {
      const el = document.getElementById(id); if (!el) return;
      el.textContent = val; el.style.color = '';
      const k = el.parentElement && el.parentElement.querySelector('.k');
      if (k && label) k.textContent = label;
    };
    setMetric('mConf', Math.round((o._riskConf || 0) * 100) + '%',
              LANG === 'ru' ? 'Уверенность' : 'Confidence');
    setMetric('mDeath', sev.label, LANG === 'ru' ? 'Уровень' : 'Severity');
    document.getElementById('mDeath').style.color = sev.color;
    setMetric('mCfr', '—', LANG === 'ru' ? 'Летальность' : 'CFR');
    setMetric('mRt', '—', 'Rₜ');
  } else {
  document.getElementById('mConf').textContent = fmtNum(o.cases);
  document.getElementById('mDeath').textContent = fmtNum(o.deaths);
  const cfr = parseFloat(o.cfr) || 0;
  document.getElementById('mCfr').textContent = cfr.toFixed(cfr<1?2:1)+'%';
  const rt = parseFloat(o.rt) || 0;
  document.getElementById('mRt').textContent  = rt.toFixed(2);
  // color the deaths metric value with severity
  document.getElementById('mDeath').style.color = sev.color;
  }

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
  trendEl.innerHTML = `${delta>=0?'+':'−'}${fmtNum(Math.abs(delta))} · 7d`;
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
    // small colored dot replaces emoji circles
    const dotFor = (level) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${riskColor[level]};margin-right:6px;vertical-align:middle;"></span>`;
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
          <span class="risk-level" style="background:${riskBg[level]};color:${riskColor[level]}">${dotFor(level)}${T('risk'+level[0].toUpperCase()+level.slice(1))}</span>
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
  document.getElementById('crumbRegion').textContent   = regionName(o.region || '');
  const crumbCntry = document.getElementById('crumbCountry');
  if(crumbCntry){
    crumbCntry.textContent = countryName(o.country);
    crumbCntry.style.cursor = 'pointer';
    crumbCntry.onclick = () => selectCountry(o.country);
  }
  document.getElementById('crumbOutbreak').textContent = diseaseName(o);

  // Travel advisory section
  const travelEl = document.getElementById('travelStatus');
  if(travelEl){
    const risk  = countryTravelRisk(o.country);
    const lang  = LANG === 'ru' ? 'ru' : 'en';
    const adv   = TRAVEL_ADVISORY[lang][risk];
    const trend = trendDirection(o.trend);
    const tLbl  = (TREND_LABELS[lang] || TREND_LABELS.en)[trend];
    const tClr  = {rising:'#C92A2A', stable:'#807E76', falling:'#3D8B5C'}[trend];
    const others = OUTBREAKS.filter(x => x.country === o.country && x.id !== o.id && !x._live);
    const othersHtml = others.length ? `
      <div class="travel-others">
        <span class="travel-others-lbl">${T('otherThreats')} ${o.country}:</span>
        ${others.slice(0,3).map(x=>`<span class="travel-tag" style="background:${SEV[x.sev].color}20;color:${SEV[x.sev].color}">${diseaseName(x.name)}</span>`).join('')}
      </div>` : '';
    travelEl.innerHTML = `
      <div class="travel-main" style="background:${adv.bg};border:1px solid ${adv.border};border-radius:var(--r-md);padding:12px 14px;">
        <div class="travel-top">
          <span class="travel-lbl">${T('travelAdvisory')}</span>
          <span class="travel-trend" style="color:${tClr};font-size:11px;font-weight:600;">${tLbl}</span>
        </div>
        <div class="travel-verdict"><span class="adv-dot" style="background:${adv.dot}"></span>${adv.label}</div>
        ${othersHtml}
      </div>`;
  }

  // Watch button state
  const watchBtn = document.getElementById('watchBtn');
  if(watchBtn){
    const watched = isWatched(o.country);
    watchBtn.textContent = T(watched ? 'watchedBtn' : 'watchBtn');
    watchBtn.style.borderColor = watched ? 'var(--accent)' : '';
    watchBtn.style.color       = watched ? 'var(--accent)' : '';
    watchBtn.onclick = () => { toggleWatch(o.country); renderPanel(); };
  }

  // Set Alert button
  const alertBtn = document.getElementById('alertBtn');
  if(alertBtn) alertBtn.onclick = () => openAlertModal(o);

  // Health Weather — async, fills #hwContent after API call
  const lon = o.lon ?? o.lng;
  if(typeof o.lat==='number' && typeof lon==='number'){
    loadHealthWeather(o.lat, lon, o.country);
  }
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
  document.getElementById('popName').textContent = o._risk ? shortTitle(o) : diseaseName(o);
  document.getElementById('popLoc').textContent  = o._risk ? fullHeadline(o) : o.place;

  // Risk/news events have no case/death counts — showing "Confirmed 0 /
  // Deaths 0" is misleading. Relabel the two metric cells to the signals we
  // actually have (Confidence · Detected) and hide the epidemic survey strip.
  const _setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  const survey = document.getElementById('popSurvey');
  if(o._risk){
    const conf = Math.round((o._riskConf != null ? o._riskConf : 0.5) * 100);
    _setText('popConfK', LANG==='ru' ? 'Доверие' : 'Confidence');
    _setText('popConf', conf + '%');
    _setText('popDeathK', LANG==='ru' ? 'Обнаружено' : 'Detected');
    _setText('popDeath', _eventWhen(o) || '—');
    document.getElementById('popDeath').style.color = '';
    if(survey) survey.style.display = 'none';
  } else {
    _setText('popConfK', LANG==='ru' ? 'Подтверждено' : 'Confirmed');
    _setText('popDeathK', LANG==='ru' ? 'Смертей' : 'Deaths');
    if(survey) survey.style.display = '';
  }
  document.getElementById('popPin').style.background = sev.color;
  document.getElementById('popSev').textContent  = sev.label;
  const tag = document.querySelector('.popup-tags .tag .dot');
  tag.className = 'dot fill-' + sevClass(o.sev);
  // Epidemic metrics only for health events — risk events were relabelled
  // (Confidence · Detected) above and their survey strip hidden.
  if(!o._risk){
    document.getElementById('popConf').textContent = fmtNum(o.cases);
    const pd = document.getElementById('popDeath');
    pd.textContent = fmtNum(o.deaths);
    pd.style.color = sev.color;
    const surv = document.getElementById('popSurvey');
    surv.style.background = grad;
    document.getElementById('popDelta').textContent = `+${fmtNum(o.new24)} ${T('newCases')}`;
    document.getElementById('popSub').textContent = T('last24hSurv', {region: regionName(o.region)});
  }
  const goCountry = document.getElementById('popGoCountry');
  if(goCountry && o.country){
    goCountry.textContent = LANG==='ru' ? `Профиль: ${countryName(o.country)} →` : `${countryName(o.country)} country profile →`;
    goCountry.onclick = () => selectCountry(o.country);
  }
}

/* chips */
document.getElementById('chips').addEventListener('click', e=>{
  const b = e.target.closest('.chip'); if(!b) return;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('is-active'));
  b.classList.add('is-active');
  state.filter = b.dataset.f;
  renderList();
  applyGLFilters();
});

/* List group/sort controls — localise labels + wire clicks (once) */
(function initListControls(){
  const bar = document.getElementById('listControls');
  if(!bar) return;
  // Localise button labels from data-en / data-ru
  bar.querySelectorAll('button[data-en]').forEach(btn=>{
    const t = LANG === 'ru' ? btn.getAttribute('data-ru') : btn.getAttribute('data-en');
    if(t) btn.textContent = t;
  });
  bar.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-v]'); if(!btn) return;
    const grp = btn.closest('[data-ctl]'); if(!grp) return;
    const ctl = grp.dataset.ctl;             // 'group' | 'sort'
    grp.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    if(ctl === 'group') state.listGroup = btn.dataset.v;
    else if(ctl === 'sort') state.listSort = btn.dataset.v;
    _listExpanded.clear();                    // reset expansions on regroup
    renderList();
  });
})();

/* Global header search — searches outbreaks AND countries in one dropdown.
   Outbreaks group → selectOutbreak(id). Countries group → selectCountry(en).  */
const _searchEl = document.getElementById('searchInput');
const _gDrop    = document.getElementById('globalDropdown');
if(_searchEl){
  let _searchTimer;
  const closeDrop = () => { if(_gDrop) _gDrop.classList.remove('on'); };
  const openDrop  = () => { if(_gDrop) _gDrop.classList.add('on'); };

  const renderGlobal = (rawQuery) => {
    if(!_gDrop) return;
    const q = (rawQuery||'').trim();
    const ql = q.toLowerCase();

    // 1) Outbreak matches (max 6) — search name, country, pathogen, code, place
    const obMatches = OUTBREAKS.filter(o => {
      if(!ql) return false;
      const hay = [o.name, o.country, o.pathogen, o.code, o.place, o.region]
        .filter(Boolean).join(' ').toLowerCase();
      return ql.split(/\s+/).every(w => hay.includes(w));
    }).slice(0, 6);

    // 2) Country matches (max 8) — by EN or RU; empty query → countries WITH outbreaks
    const outbreakCountFor = (en) => OUTBREAKS.filter(o => {
      if(o.country === en) return true;
      const c = findCountry(o.country); return c && c.en === en;
    }).length;
    const cMatches = ALL_COUNTRIES.filter(c =>
      !ql ? outbreakCountFor(c.en) > 0
          : (c.en.toLowerCase().includes(ql) || c.ru.toLowerCase().includes(ql))
    ).slice(0, 8);

    if(!obMatches.length && !cMatches.length){
      _gDrop.innerHTML = `<div class="g-empty">${LANG==='ru'?'Ничего не найдено':'No matches'}</div>`;
      openDrop();
      return;
    }

    let html = '';
    if(obMatches.length){
      html += `<div class="g-drop-h">${LANG==='ru'?'Вспышки':'Outbreaks'}</div>`;
      html += obMatches.map(o => {
        const sev = SEV[o.sev] || SEV.warning;
        const ini = (o.country||'??').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
        const sevLabel = (LANG==='ru'
          ? {critical:'Крит.', alert:'Алерт', warning:'Средн.', monitoring:'Низк.', low:'Низк.'}
          : {critical:'Crit.', alert:'Alert', warning:'Warning', monitoring:'Monitor', low:'Low'})[o.sev] || o.sev;
        return `<div class="g-row" data-kind="outbreak" data-id="${o.id}">
          <span class="sq" style="background:${hexA(sev.color,0.12)};color:${sev.color};">${ini}</span>
          <span class="info"><span class="nm">${diseaseName(o)}</span><span class="sub">${countryName(o.country)} · ${regionName(o.region)}</span></span>
          <span class="tag" style="background:${hexA(sev.color,0.12)};color:${sev.color};">${sevLabel}</span>
        </div>`;
      }).join('');
    }
    if(cMatches.length){
      html += `<div class="g-drop-h">${LANG==='ru'?'Страны':'Countries'}</div>`;
      html += cMatches.map(c => {
        const n = outbreakCountFor(c.en);
        const tag = n > 0
          ? `<span class="tag" style="background:rgba(232,89,12,0.12);color:var(--accent);">${n}</span>`
          : `<span class="tag" style="background:var(--line-soft);color:var(--muted);">—</span>`;
        return `<div class="g-row" data-kind="country" data-name="${c.en}">
          <span class="flag">${flagEmoji(c.iso2)}</span>
          <span class="info"><span class="nm">${LANG==='ru'?c.ru:c.en}</span><span class="sub">${LANG==='ru'?'Профиль страны':'Country profile'}</span></span>
          ${tag}
        </div>`;
      }).join('');
    }
    _gDrop.innerHTML = html;
    openDrop();

    _gDrop.querySelectorAll('.g-row').forEach(el => {
      el.addEventListener('click', () => {
        if(el.dataset.kind === 'outbreak'){
          selectOutbreak(el.dataset.id);
        } else if(el.dataset.kind === 'country'){
          selectCountry(el.dataset.name);
        }
        closeDrop();
        _searchEl.blur();
      });
    });

    // Mirror results to mobile search overlay
    const mobResults = document.getElementById('mobSearchResults');
    if(mobResults){
      mobResults.innerHTML = html;
      mobResults.querySelectorAll('.g-row').forEach(el => {
        el.addEventListener('click', () => {
          if(el.dataset.kind === 'outbreak') selectOutbreak(el.dataset.id);
          else if(el.dataset.kind === 'country') selectCountry(el.dataset.name);
          const searchOv = document.getElementById('mobSearchOverlay');
          if(searchOv) searchOv.classList.remove('mob-active');
          const mi = document.getElementById('mobSearchInput');
          if(mi) mi.value = '';
          _searchEl.value = '';
        });
      });
    }
  };

  _searchEl.addEventListener('focus', () => renderGlobal(_searchEl.value));
  let _searchTracked = false;
  _searchEl.addEventListener('input', e=>{
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(()=>{
      const q = e.target.value.trim();
      state.query = q;
      renderGlobal(_searchEl.value);
      renderList();
      if(q.length >= 2 && !_searchTracked){
        _searchTracked = true;
        track('Search', { query: q });
      }
      if(!q) _searchTracked = false;
    }, 140);
  });
  document.addEventListener('click', e=>{
    if(!_searchEl.contains(e.target) && !(_gDrop && _gDrop.contains(e.target))) closeDrop();
  });

  // ⌘K / Ctrl+K focus shortcut
  document.addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && e.key==='k'){
      e.preventDefault(); _searchEl.focus(); _searchEl.select();
    }
    if(e.key==='Escape' && document.activeElement===_searchEl){
      _searchEl.value=''; state.query=''; renderList(); closeDrop(); _searchEl.blur();
    }
  });
}

/* =========================================================
   LIVE DATA  (public/events.json — updated by GitHub Actions)
   ========================================================= */

// Severity mapping: API strings → OUTBREAKS sev keys
const SEV_MAP = { critical:'critical', alert:'alert', high:'alert', warning:'warning', medium:'warning', low:'monitoring', monitoring:'monitoring' };

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

      const liveSev = SEV_MAP[ev.severity] || 'monitoring';
      const _fl = (ev.type === 'food') ? shortFoodLabel(ev.disease, ev.summary) : null;
      OUTBREAKS.unshift({
        id: evId,
        type: ev.type || 'epidemic',
        code: `LIVE-${ev.source}-${new Date(ev.fetched_at||ev.date).toISOString().slice(0,10)}`,
        name: _fl ? _fl.en : ev.disease,
        name_ru: _fl ? _fl.ru : (ev.name_ru || ev.disease),
        pathogen: ev.disease,
        country: ev.country,
        iso: coords.isoNum,
        region: ev.region || 'UNKNOWN',
        place: ev.country,
        lat: coords.lat,
        lon: coords.lng,
        sev: liveSev,
        who: ev.source ? `${ev.source} · live` : 'live feed',
        cases: ev.cases || 0,
        deaths: ev.deaths || 0,
        cfr: ev.cases && ev.deaths ? parseFloat(((ev.deaths/ev.cases)*100).toFixed(1)) : 0,
        rt: 1.0,
        new24: 0,
        sevIdx: {critical:80,alert:60,warning:40,monitoring:20}[liveSev],
        trend: [0,0,0,0,0,0,0, ev.cases||0],
        blurb: ev.summary || '',
        blurb_ru: ev.summary_ru || ev.summary || '',
        events: [],
        _live: true,
        _link: ev.link,
      });

      if(coords.isoNum) HIGHLIGHT_ISO.add(coords.isoNum);
      injected++;
    }

    // ── B2B risk events → globe (conflict / transport / border /
    //    infrastructure / climate, incl. CIS & China). Additive &
    //    fail-safe: never breaks the globe if the feed is missing. ──
    try {
      const rr = await fetch(base + 'public/risk_events.json?_=' + Date.now());
      if (rr.ok) {
        const rj = await rr.json();
        const SEVN = ['monitoring','low','warning','alert','critical','catastrophic'];
        const RTYPE = { health:'epidemic', climate:'disaster',
          conflict:'humanitarian', civil_unrest:'humanitarian',
          transport:'humanitarian', border:'humanitarian',
          infrastructure:'blackout' };
        for (const ev of (rj.events || [])) {
          if (ev.category === 'health') continue;   // health already via events.json
          const g = ev.geo || {};
          if (typeof g.lat !== 'number' || typeof g.lng !== 'number') continue;
          const rid = 'risk-' + ev.id;
          if (OUTBREAKS.find(o => o.id === rid)) continue;
          const sev = SEVN[Math.max(0, Math.min(5, Math.round(ev.severity || 0)))]
                      || 'monitoring';
          const verif = ev.source_verification === 'official_agency'
            ? (LANG === 'ru' ? 'офиц. ведомство' : 'official')
            : (LANG === 'ru' ? 'медиа-сигнал' : 'media signal');
          OUTBREAKS.unshift({
            id: rid,
            type: RTYPE[ev.category] || 'humanitarian',
            code: `RISK-${String(ev.category || '').toUpperCase()}`,
            name: ev.headline || ev.type || ev.category,
            name_ru: ev.headline || ev.type || ev.category,
            pathogen: ev.type || ev.category,
            country: g.country || ev.country,
            iso: null,
            region: 'RISK',
            place: g.place || g.country || ev.country,
            lat: g.lat, lon: g.lng,
            sev,
            who: `${ev.source_name || ev.category} · ${verif}`,
            cases: 0, deaths: 0, cfr: 0, rt: 0, new24: 0,
            sevIdx: Math.round((ev.confidence || 0.5) * 100),
            trend: [],
            blurb: ev.headline || '',
            blurb_ru: ev.headline || '',
            events: [],
            _live: true, _risk: true, _link: ev.url,
            _riskCat: ev.category,
            _riskVerif: ev.source_verification,
            _riskConf: ev.confidence,
          });
          injected++;
        }
      }
    } catch (e) { /* risk feed optional — never break the globe */ }

    // ── Risk index (7-domain breakdown per ISO-2) ──
    try {
      const ri = await fetch(base + 'public/risk_index.json?_=' + Date.now());
      if(ri.ok){
        const rj = await ri.json();
        RISK_INDEX = rj.index || {};
        try { refreshCountryRiskFill(); } catch(_){}
        try { renderMyCountries(); } catch(_){}   // re-render watchlist now that risk + deltas are available
      }
    } catch(_e){ /* graceful — country panel shows "no data" */ }

    try {
      // Live feed first (daily osint-ingest → /api/country-signals).
      // 204 or any failure → fall back to committed static seed. Zero-risk.
      let cj = null;
      try {
        const live = await fetch('/api/country-signals', { signal: AbortSignal.timeout(6000) });
        if(live.ok) cj = await live.json();   // 204 → live.ok false → fallback
      } catch(_live){ /* fall through to static seed */ }
      if(!cj){
        const cs = await fetch(base + 'public/country-signals.json?_=' + Date.now());
        if(cs.ok) cj = await cs.json();
      }
      if(cj){
        COUNTRY_SIGNALS = cj.signals || {};
        if(cj.meta?.bootstrapping) console.log('[Vigilo] OSINT feed bootstrapping — FX flow blends curated until ~30 daily snapshots');
      }
    } catch(_e){ /* graceful — signals are additive, never block */ }

    try {
      const st = await fetch(base + 'public/country-structural.json?_=' + Date.now());
      if(st.ok){ const sj = await st.json(); COUNTRY_STRUCTURAL = sj.structural || {}; }
    } catch(_e){ /* graceful — INFORM modifier defaults to neutral 1.0 */ }

    try {
      const mc = await fetch(base + 'public/macro.json?_=' + Date.now());
      if(mc.ok){ const mj = await mc.json(); COUNTRY_MACRO = mj.macro || {}; }
    } catch(_e){ /* graceful — macro is additive, never blocks */ }

    if(injected > 0){
      console.log(`[Vigilo] Injected ${injected} live events`);
      renderList();
      renderPanel();
      renderPopup();
      addGLMarkers();
      renderCatLists();
      updateMobPeek();
    }
  } catch(e){
    console.warn('[Vigilo] Live data unavailable:', e.message);
  }
}

/* =========================================================
   BOOT
   ========================================================= */
async function boot(){
  initMap();
  // Country topojson still loaded for the heatmap view (uses d3.geoNaturalEarth1)
  try{
    const res = await fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json');
    const topo = await res.json();
    state.countries = topojson.feature(topo, topo.objects.countries).features;
  } catch(err){ console.error('world atlas failed', err); }
  renderList();
  renderPanel();
  renderPopup();
  renderMyCountries();
  renderMyFeed();
  renderCatLists();
  updateUserBtn();
  initBottomSheet();
  updateMobPeek();

  // Sync watched countries from server (if logged in)
  loadServerCountries();

  // Load food safety recalls
  loadFoodRecalls();

  // Load historical time-series
  loadHistory();

  // Preload city anchors for the AQI layer
  loadCities();

  // Load live data after globe is visible
  loadLiveData();
  // Refresh every 30 minutes
  setInterval(loadLiveData, 30 * 60 * 1000);

  // Category sections wiring: expand/collapse + switch toggle
  document.getElementById('catSections')?.addEventListener('click', e=>{
    const toggle = e.target.closest('.sw-toggle');
    if(toggle){ toggleCat(toggle.dataset.cat); return; }
    const expand = e.target.closest('.sw-expand');
    if(expand){
      const section = expand.closest('.cat-section');
      if(!section) return;
      const isOpen = section.classList.contains('expanded');
      // close all, then open clicked (accordion)
      document.querySelectorAll('.cat-section').forEach(s => s.classList.remove('expanded'));
      if(!isOpen) section.classList.add('expanded');
    }
  });

  // Alert modal tier selection
  document.getElementById('alertModal')?.addEventListener('click', e => {
    const tier = e.target.closest('.alert-tier');
    if(!tier) return;
    tier.closest('.alert-tiers')?.querySelectorAll('.alert-tier').forEach(t => t.classList.remove('is-selected'));
    tier.classList.add('is-selected');
    tier.querySelector('input').checked = true;
  });

  // Expose submit handler globally (called from onsubmit attr)
  window._submitAlertModal = _submitAlertModal;

  // Country search wiring — full ALL_COUNTRIES list, flags, outbreak count
  const csInput = document.getElementById('countrySearch');
  const csDD    = document.getElementById('countryDropdown');
  if(csInput && csDD){
    // Count outbreaks per English country name for the right-hand badge
    const outbreakCountFor = (en) => OUTBREAKS.filter(o => {
      if(o.country === en) return true;
      const c = findCountry(o.country); return c && c.en === en;
    }).length;

    const renderDropdown = (q) => {
      const ql = (q||'').toLowerCase().trim();
      const matches = ALL_COUNTRIES.filter(c =>
        !ql
          ? outbreakCountFor(c.en) > 0  // empty query → show only countries with outbreaks
          : c.en.toLowerCase().includes(ql) || c.ru.toLowerCase().includes(ql)
      );
      if(!matches.length){
        csDD.innerHTML = `<div class="cs-empty">${LANG==='ru'?'Ничего не найдено':'No matches'}</div>`;
        csDD.style.display = 'block';
        return;
      }
      csDD.innerHTML = matches.slice(0, 20).map(c => {
        const n = outbreakCountFor(c.en);
        const badge = n > 0
          ? `<span class="cs-badge">${n}</span>`
          : `<span class="cs-badge cs-badge--quiet">${LANG==='ru'?'—':'—'}</span>`;
        return `<div class="cs-item" data-country="${c.en}"><span class="cs-flag">${flagEmoji(c.iso2)}</span><span class="cs-name">${LANG==='ru'?c.ru:c.en}</span>${badge}</div>`;
      }).join('');
      csDD.style.display = 'block';
      csDD.querySelectorAll('.cs-item').forEach(el=>{
        el.addEventListener('click', ()=> selectCountry(el.dataset.country));
      });
    };
    csInput.addEventListener('focus', ()=> renderDropdown(csInput.value));
    csInput.addEventListener('input', ()=> renderDropdown(csInput.value));
    csInput.addEventListener('keydown', e=>{
      if(e.key==='Escape'){ selectCountry(null); csInput.blur(); }
    });
    document.addEventListener('click', e=>{
      if(!csInput.contains(e.target) && !csDD.contains(e.target)) csDD.style.display='none';
    });
  }
}
// Expose for the mobile UI controller (const bindings aren't on window
// in a classic script; function declarations are, but be explicit).
window.state         = state;
window.CATEGORY_META = CATEGORY_META;
window.toggleCat     = toggleCat;
window.switchView    = switchView;
window.renderMyFeed  = renderMyFeed;
window.renderMyFeedItems = renderMyFeedItems;
window.selectOutbreak  = selectOutbreak;
window.selectCountry   = selectCountry;
window.OUTBREAKS     = OUTBREAKS;
window.SEV           = SEV;
window.diseaseName   = diseaseName;
window.countryName   = countryName;
window.flagEmoji     = flagEmoji;
window.findCountry   = findCountry;

boot();

/* =========================================================
   MOBILE BOTTOM SHEET
   ========================================================= */

const isMob = () => window.innerWidth <= 768;

function updateMobPeek(){
  if(!isMob()) return;
  const c = OUTBREAKS.filter(o=>o.sev==='critical').length;
  const a = OUTBREAKS.filter(o=>o.sev==='alert').length;
  const t = OUTBREAKS.length;
  const ec = document.getElementById('mpsC'); if(ec) ec.textContent = c;
  const ea = document.getElementById('mpsA'); if(ea) ea.textContent = a;
  const et = document.getElementById('mpsT'); if(et) et.textContent = t;
}

function mobSnapTo(state){
  const sb = document.querySelector('.sidebar');
  if(!sb) return;
  sb.style.height = '';          // clear any drag-set inline height
  sb.classList.remove('mob-mid','mob-full','mob-visible');
  if(state === 'mid')  sb.classList.add('mob-mid');
  if(state === 'full') sb.classList.add('mob-full');
  const chev = document.getElementById('mobPeekChev');
  if(chev) chev.style.transform = state === 'collapsed' ? '' : 'rotate(180deg)';
}

function mobSnapToggle(){
  const sb = document.querySelector('.sidebar');
  if(!sb) return;
  const isMid  = sb.classList.contains('mob-mid');
  const isFull = sb.classList.contains('mob-full');
  if(isFull)       mobSnapTo('mid');
  else if(isMid)   mobSnapTo('collapsed');
  else             mobSnapTo('mid');
}

function initBottomSheet(){
  if(!isMob()) return;
  const sb   = document.querySelector('.sidebar');
  const peek = document.getElementById('mobPeek');
  if(!sb || !peek) return;

  let startY = 0, startH = 0, dragging = false;
  const COLLAPSED = 68;
  const getMid  = () => window.innerHeight * 0.58;
  const getFull = () => window.innerHeight - 52;

  peek.addEventListener('touchstart', e=>{
    startY = e.touches[0].clientY;
    startH = sb.offsetHeight;
    dragging = true;
    sb.style.transition = 'none';
  }, {passive:true});

  document.addEventListener('touchmove', e=>{
    if(!dragging) return;
    const dy  = startY - e.touches[0].clientY;
    const newH = Math.max(COLLAPSED, Math.min(getFull(), startH + dy));
    sb.style.height = newH + 'px';
  }, {passive:true});

  document.addEventListener('touchend', e=>{
    if(!dragging) return;
    dragging = false;
    sb.style.transition = '';
    const curH  = sb.offsetHeight;
    const velUp = (startY - e.changedTouches[0].clientY) > 30;
    const velDn = (startY - e.changedTouches[0].clientY) < -30;
    const mid   = getMid();
    const full  = getFull();

    if(velDn || curH < (COLLAPSED + mid) / 2)      mobSnapTo('collapsed');
    else if(velUp || curH > (mid + full) / 2)       mobSnapTo('full');
    else                                             mobSnapTo('mid');
  }, {passive:true});

  // Update overview tab to use bottom sheet instead of old mob-visible overlay
  document.querySelectorAll('.mob-nav-btn[data-action="overview"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const isOpen = sb.classList.contains('mob-mid') || sb.classList.contains('mob-full');
      mobSnapTo(isOpen ? 'collapsed' : 'mid');
    });
  });

  updateMobPeek();
}

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
const VIEW_NAMES = ['globe','heatmap','list'];
let currentView = 'globe';

function switchView(name){
  if(!VIEW_NAMES.includes(name)) return;
  currentView = name;
  APP.className = `app v-${name}`;
  // Both 'globe' and 'heatmap' reuse view-globe (flat vs sphere Mapbox projection)
  VIEW_NAMES.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if(el) el.classList.toggle('is-active', (name === 'heatmap') ? v === 'globe' : v === name);
  });
  document.querySelectorAll('.top-tab[data-view]').forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.view === name);
  });
  const sg = document.querySelector('.sidebar-globe');
  if(sg) sg.classList.remove('hidden');

  // Switch Mapbox projection
  if(map){
    if(name === 'globe')   map.setProjection({ name:'globe' });
    if(name === 'heatmap') map.setProjection({ name:'mercator' });
    if(name === 'list')    map.setProjection({ name:'globe' });
  }
}

// Wire up top tabs by data-view (3D / Карта / Список)
document.querySelectorAll('.top-tab[data-view]').forEach(tab => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.view);
    track('View Switch', { view: tab.dataset.view });
  });
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
