// netlify/functions/_lib/osint-sources.mjs
//
// OSINT live-feed source fetchers for the daily `osint-ingest` job.
//
// Honest design note: free, no-key, *historical* FX for crisis currencies
// (SDG, IRR, VES, CUP, AFN, MMK) does NOT exist reliably. So instead of
// faking liveness we SNAPSHOT rates daily into a Blob and compute the
// 30-day flow from our OWN accumulating history. Day 1 = curated seed;
// each day more real; after ~30 runs flow is fully live. Self-improving.
//
// Every fetcher is defensive: partial failure never breaks the feed.

const TIMEOUT = 9000;

// ISO-2 → ISO-4217 for tracked countries
export const CCY = {
  RU:'RUB', IR:'IRR', CU:'CUP', VE:'VES', MM:'MMK', ET:'ETB', SD:'SDG',
  AF:'AFN', US:'USD', DE:'EUR', GB:'GBP', IN:'INR', PK:'PKR', TH:'THB',
  NG:'NGN', UA:'UAH',
};

// Currencies where the free "latest" rate is a meaningless official peg
// (parallel/black-market rate is the real one — not freely available).
// For these we KEEP the curated seed and never claim a live override.
const PEG_BLOCKLIST = new Set(['IRR','VES','CUP','SDG']);

async function getJSON(url){
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if(!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

/* ── FX: daily snapshot of USD→local rates (free, no key) ─────────────
   open.er-api.com covers ~160 currencies, updates daily, no API key. */
export async function fetchFxSnapshot(){
  const d = await getJSON('https://open.er-api.com/v6/latest/USD');
  if(!d || d.result !== 'success' || !d.rates) throw new Error('er-api bad payload');
  const snap = {};
  for(const [iso2, ccy] of Object.entries(CCY)){
    if(d.rates[ccy] != null) snap[iso2] = d.rates[ccy]; // units of local per 1 USD
  }
  return { day: new Date().toISOString().slice(0,10), rates: snap };
}

/* Compute 30-day flow (% the local currency weakened vs USD) + acceleration
   from accumulated daily snapshots. Returns per-ISO2 { drop_30d_pct,
   accelerating } only for currencies with enough clean history. */
export function computeFxFlow(history /* [{day, rates}] sorted asc */){
  const out = {};
  if(!Array.isArray(history) || history.length < 8) return out; // not enough yet
  const latest = history[history.length - 1];
  const at = (daysAgo) => history[Math.max(0, history.length - 1 - daysAgo)];
  const d30 = at(30), d15 = at(15);

  for(const iso2 of Object.keys(CCY)){
    const ccy = CCY[iso2];
    if(PEG_BLOCKLIST.has(ccy)) continue;          // keep curated for pegged ccys
    const now = latest.rates?.[iso2];
    const r30 = d30?.rates?.[iso2];
    const r15 = d15?.rates?.[iso2];
    if(!now || !r30) continue;
    // rate = local per USD; rate ↑ ⇒ currency weakened ⇒ positive "drop"
    const drop30 = +(((now - r30) / r30) * 100).toFixed(1);
    let accelerating = false;
    if(r15){
      const recent = (now - r15) / r15;           // last 15d velocity
      const prior  = (r15 - r30) / r30;            // prior 15d velocity
      accelerating = recent > prior && recent > 0.02;
    }
    out[iso2] = { drop_30d_pct: Math.max(0, drop30), accelerating };
  }
  return out;
}

/* ── IODA: internet outages (free, no key) ───────────────────────────
   Georgia Tech / CAIDA. We map alert presence → our severity scale. */
export async function fetchIodaInternet(iso2List){
  const out = {};
  const until = Math.floor(Date.now() / 1000);
  const from  = until - 3 * 86400; // last 72h
  await Promise.allSettled(iso2List.map(async (iso2) => {
    try{
      const u = `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts`
              + `?from=${from}&until=${until}&entityType=country&entityCode=${iso2}`;
      const d = await getJSON(u);
      const alerts = (d && (d.data || d.alerts)) || [];
      const n = Array.isArray(alerts) ? alerts.length : 0;
      if(n > 0){
        out[iso2] = {
          shutdown: n >= 3,
          severity: n >= 6 ? 'severe' : n >= 3 ? 'elevated' : 'moderate',
          source: 'IODA',
          note: `IODA flagged ${n} outage alert(s) in last 72h`,
          live: true,
        };
      }
    }catch(_){ /* per-country failure is fine */ }
  }));
  return out;
}

export { PEG_BLOCKLIST };
