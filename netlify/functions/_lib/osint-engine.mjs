// netlify/functions/_lib/osint-engine.mjs
//
// Server-side port of the covert-risk engine (browser: globe.js
// computeCovertRisk). Pure & deterministic — no DOM, no globals.
// Source of truth for the DURABLE journal. The browser keeps an instant
// preview compute; small honest divergence: server uses risk_index
// health.active_events for officialActivity (browser adds live OUTBREAKS).
//
// Includes the two theory fixes already validated:
//   • Meadows stock→flow  : currency = 30d velocity + acceleration
//   • Bayes transparency  : silence is evidence only ∝ how openly a
//                           country reports (closed regime ⇒ ~0 bits)

// ISO-2 transparency tiers (server is ISO2-native)
const OPAQUE = new Set(['KP','TM','ER','SY','AF']);              // 0.25
const SEMI   = new Set(['RU','CN','BY','IR','VE','MM','TJ','UZ', // 0.45
                         'CU','LA','GQ','AZ','NI','BI']);
const OPEN   = new Set(['US','CA','GB','IE','DE','FR','IT','ES', // 0.92
                         'PT','NL','BE','LU','CH','AT','SE','NO',
                         'FI','DK','IS','EE','LV','LT','PL','CZ',
                         'SK','SI','HU','HR','GR','JP','KR','SG',
                         'TW','HK','AU','NZ','IL','AE','QA','MT']);
function transparency(iso2){
  if(OPAQUE.has(iso2)) return 0.25;
  if(SEMI.has(iso2))   return 0.45;
  if(OPEN.has(iso2))   return 0.92;
  return 0.70;
}

/* INFORM structural modifier. Same raw signal is amplified in a fragile/
   low-coping country, damped in a resilient one. Neutral (1.0) when the
   country has no INFORM entry → falls back to existing baseline behaviour. */
export function informModifier(struct){
  if(!struct || struct.vulnerability == null || struct.coping == null) return 1.0;
  const F = Math.max(0, Math.min(1, (struct.vulnerability * struct.coping) / 100));
  return +Math.max(0.70, Math.min(1.60, 0.70 + F * 1.6)).toFixed(3);
}

/* Deterministic covert-risk verdict for one country.
   ri = risk_index.json entry; cs = country-signals feed entry;
   struct = country-structural.json entry (INFORM). */
export function computeCovertRisk(iso2, ri, cs, struct){
  const cb = ri?.category_breakdown || {};
  const conflict = cb.conflict?.score       || 0;
  const unrest   = cb.civil_unrest?.score   || 0;
  const border   = cb.border?.score         || 0;
  let   infra    = cb.infrastructure?.score || 0;

  if(cs?.internet?.shutdown)
    infra += ({ severe:2, elevated:1.3, moderate:0.7 }[cs.internet.severity] || 0);
  if(cs?.power_grid?.alert)
    infra += ({ critical:1.5, elevated:1 }[cs.power_grid.severity] || 0.5);
  infra = Math.min(5, infra);

  // Meadows: currency = FLOW not STOCK
  const fxFlow = cs?.currency?.drop_30d_pct || 0;
  let currencyIdx = fxFlow >= 20 ? 5 : fxFlow >= 12 ? 3.5 : fxFlow >= 6 ? 2 : fxFlow >= 3 ? 1 : 0;
  if(cs?.currency?.accelerating && currencyIdx > 0) currencyIdx = Math.min(5, currencyIdx + 0.5);

  const behavioralRaw = Math.min(5,
    0.30*conflict + 0.20*unrest + 0.22*infra + 0.16*currencyIdx + 0.12*border);

  // INFORM structural damping/amplification (fragile ↑, resilient ↓)
  const M = informModifier(struct);
  const behavioral = +Math.min(5, behavioralRaw * M).toFixed(2);

  const healthScore = cb.health?.score || 0;
  const activeEpi   = cb.health?.active_events || 0;
  const officialActivity = +(healthScore + Math.min(2, activeEpi * 0.4)).toFixed(2);

  const divergence = +(behavioral - officialActivity).toFixed(2);

  // Bayes transparency discount
  const T = transparency(iso2);
  const silenceInformative = officialActivity <= 1.0 ? T : 1;
  const adjDivergence = +(divergence * silenceInformative).toFixed(2);

  let tier;
  if(behavioral >= 3.5 && officialActivity <= 1.0 && adjDivergence >= 2.5)
       tier = 'covert_elevated';
  else if(behavioral >= 3.0)
       tier = 'elevated_watch';
  else tier = 'nominal';

  const opacitySuppressed =
    behavioral >= 3.5 && officialActivity <= 1.0 && divergence >= 2.5
    && tier !== 'covert_elevated';

  const reasons = [];
  if(conflict >= 2) reasons.push('conflict:'+conflict.toFixed(1));
  if(unrest   >= 2) reasons.push('unrest:'+unrest.toFixed(1));
  if(cs?.internet?.shutdown) reasons.push('internet:'+cs.internet.severity);
  if(cs?.power_grid?.alert)  reasons.push('power_grid:'+cs.power_grid.severity);
  if(fxFlow >= 6) reasons.push('currency_30d:-'+fxFlow+'%'+(cs?.currency?.accelerating?'^':''));
  if(border   >= 2) reasons.push('border:'+border.toFixed(1));
  if(M !== 1.0)     reasons.push('inform:M='+M);
  if(opacitySuppressed) reasons.push('opacity_suppressed:T='+T);

  return {
    iso2, tier,
    behavioralRaw: +behavioralRaw.toFixed(2),
    behavioral, informM: M,
    officialActivity, divergence, adjDivergence,
    transparency: T, opacitySuppressed, reasons,
  };
}

export { transparency };
