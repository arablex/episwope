// netlify/functions/osint-ingest.mjs
//
// Phase 1 of the OSINT live feed. Runs daily. Replaces the hand-maintained
// public/country-signals.json with a live, self-accumulating feed.
//
// Strategy (honest):
//  • curated seed (committed public/country-signals.json) = always the base
//  • daily FX snapshot accumulates into a Blob → real 30d flow after ~30 runs
//  • IODA internet outages = live, no key
//  • pegged crisis currencies (IRR/VES/CUP/SDG): keep curated, never fake live
//  • partial source failure NEVER breaks the feed — always emits valid JSON
//
// Output → Blob store `osint`, key `country-signals`. Served by
// /api/country-signals; frontend falls back to the static file if absent.

import { getStore } from '@netlify/blobs';
import { fetchFxSnapshot, computeFxFlow, fetchIodaInternet, CCY }
  from './_lib/osint-sources.mjs';
import { computeCovertRisk, transparency } from './_lib/osint-engine.mjs';
import { labelJournal, detectMissed, officialSnapshot } from './_lib/osint-label.mjs';

const FX_HISTORY_KEY = 'fx-history';
const FEED_KEY        = 'country-signals';
const JOURNAL_KEY     = 'journal';
const MISSED_KEY      = 'missed';
const GLOBAL_KEY      = 'global-history';   // our own daily world snapshot
const HISTORY_MAX     = 45;   // days of FX snapshots to retain
const JOURNAL_MAX     = 4000; // durable observations retained
const MISSED_MAX      = 2000;
const GLOBAL_MAX      = 400;  // ~13 months of daily global snapshots

function store(){ return getStore({ name: 'osint', consistency: 'strong' }); }

async function loadCuratedSeed(){
  // The committed static file is our curated base — always deployed.
  try{
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
    const r = await fetch(base + '/public/country-signals.json',
                          { signal: AbortSignal.timeout(8000) });
    if(r.ok) return await r.json();
  }catch(_){}
  return { meta:{}, signals:{} };
}

export default async () => {
  const s = store();
  const report = { fx:false, ioda:false, fxLive:0, iodaLive:0, errors:[] };

  // 1 ── curated seed (base)
  const seed = await loadCuratedSeed();
  const signals = JSON.parse(JSON.stringify(seed.signals || {}));

  // 2 ── FX snapshot → accumulate history
  let history = (await s.get(FX_HISTORY_KEY, { type:'json' })) || [];
  try{
    const snap = await fetchFxSnapshot();
    if(!history.some(h => h.day === snap.day)) history.push(snap);
    history = history.slice(-HISTORY_MAX);
    await s.setJSON(FX_HISTORY_KEY, history);
    report.fx = true;
  }catch(e){ report.errors.push('fx:'+e.message); }

  // 3 ── compute real 30d flow from accumulated history (where clean)
  const fxFlow = computeFxFlow(history);
  for(const [iso2, f] of Object.entries(fxFlow)){
    if(!signals[iso2]) signals[iso2] = {};
    const cur = signals[iso2].currency || {};
    signals[iso2].currency = {
      ...cur,
      drop_30d_pct: f.drop_30d_pct,
      accelerating: f.accelerating,
      source: 'live:open-er-api',
      live: true,
    };
    report.fxLive++;
  }

  // 4 ── IODA internet outages (live)
  try{
    const ioda = await fetchIodaInternet(Object.keys(CCY));
    for(const [iso2, net] of Object.entries(ioda)){
      if(!signals[iso2]) signals[iso2] = {};
      signals[iso2].internet = net;
      report.iodaLive++;
    }
    report.ioda = true;
  }catch(e){ report.errors.push('ioda:'+e.message); }

  // 5 ── assemble + provenance meta
  const bootstrapping = history.length < 30; // FX flow not yet fully live
  const feed = {
    meta: {
      generated_at: new Date().toISOString(),
      version: '2.0-live',
      pipeline: 'osint-ingest',
      fx_history_days: history.length,
      bootstrapping,                       // true → flow partly curated still
      description: bootstrapping
        ? 'Live feed bootstrapping — FX flow blends curated seed until ~30 daily snapshots accumulate. Internet via IODA is live now.'
        : 'Live feed — FX flow computed from accumulated daily snapshots; internet via IODA.',
      live_sources: ['open-er-api (FX)', 'IODA (internet)'],
      curated_fallback: ['pegged currencies IRR/VES/CUP/SDG', 'wastewater', 'food_price_idx', 'power_grid'],
      run_report: report,
    },
    signals,
  };

  await s.setJSON(FEED_KEY, feed);

  // 6 ── run the covert-risk engine → durable journal (Phase 2)
  //      Server-authored: accumulates even if the owner never opens the app.
  let journalWrites = 0;
  try{
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
    let RISK_INDEX = {};
    try{
      const r = await fetch(base + '/public/risk_index.json',
                            { signal: AbortSignal.timeout(8000) });
      if(r.ok){ const rj = await r.json(); RISK_INDEX = rj.index || {}; }
    }catch(_){}

    let STRUCT = {};
    try{
      const r = await fetch(base + '/public/country-structural.json',
                            { signal: AbortSignal.timeout(8000) });
      if(r.ok){ const sj = await r.json(); STRUCT = sj.structural || {}; }
    }catch(_){}

    const journal = (await s.get(JOURNAL_KEY, { type:'json' })) || [];
    const day = new Date().toISOString().slice(0,10);

    for(const iso2 of Object.keys(signals)){
      const v = computeCovertRisk(iso2, RISK_INDEX[iso2], signals[iso2], STRUCT[iso2]);
      if(v.tier === 'nominal') continue;                       // only signal-bearing
      if(journal.some(e => e.day === day && e.iso2 === iso2)) continue; // dedup
      journal.push({
        day, iso2, tier:v.tier,
        behavioralRaw:v.behavioralRaw, behavioral:v.behavioral, informM:v.informM,
        officialActivity:v.officialActivity,
        officialSnapshot: officialSnapshot(RISK_INDEX[iso2]), // prediction-time baseline for independent confirmation
        divergence:v.divergence, adjDivergence:v.adjDivergence,
        transparency:v.transparency, opacitySuppressed:v.opacitySuppressed,
        reasons:v.reasons, ts:Date.now(), outcome:null, source:'server',
      });
      journalWrites++;
    }

    // ── Close the loop: auto-label past predictions vs official reality ──
    const score = labelJournal(journal, RISK_INDEX, transparency);
    await s.setJSON(JOURNAL_KEY, journal.slice(-JOURNAL_MAX));

    // ── Recall side: official escalations we did NOT flag (false-neg) ──
    const missedLog = (await s.get(MISSED_KEY, { type:'json' })) || [];
    const missedNow = detectMissed(journal, RISK_INDEX, day)
      .filter(m => !missedLog.some(x => x.day === m.day && x.iso2 === m.iso2));
    if(missedNow.length){
      await s.setJSON(MISSED_KEY, [...missedLog, ...missedNow].slice(-MISSED_MAX));
    }

    report.score = score;
    report.missedNew = missedNow.length;

    // ── Accumulate OUR daily global snapshot (the model learns the
    //    world baseline — what's normal globally — for later drift /
    //    "whole world heating up" detection. Product use decided later) ──
    try{
      const todays = journal.filter(e => e.day === day);
      const byTier = {};
      let behSum = 0, divSum = 0;
      for(const e of todays){
        byTier[e.tier] = (byTier[e.tier]||0)+1;
        behSum += e.behavioral||0; divSum += e.adjDivergence||0;
      }
      const byBand = {}; const doms = {}; let indexed=0, severe=0;
      for(const k in RISK_INDEX){
        indexed++;
        const cr = RISK_INDEX[k].composite_risk || {};
        byBand[cr.band] = (byBand[cr.band]||0)+1;
        if(cr.band==='severe'||cr.band==='critical') severe++;
        if(cr.dominant_category) doms[cr.dominant_category]=(doms[cr.dominant_category]||0)+1;
      }
      const topDomains = Object.entries(doms).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([d,c])=>({d,c}));
      const snap = {
        day, ts: Date.now(),
        official: { indexed, severe, byBand, topDomains },
        osint: {
          predictions: todays.length,
          byTier,
          avgBehavioral: todays.length ? +(behSum/todays.length).toFixed(2) : 0,
          avgDivergence: todays.length ? +(divSum/todays.length).toFixed(2) : 0,
          missedNew: missedNow.length,
        },
        precision: score.precision, avgLeadDays: score.avgLeadDays,
      };
      const gh = (await s.get(GLOBAL_KEY, { type:'json' })) || [];
      if(!gh.some(x => x.day === day)){
        gh.push(snap);
        await s.setJSON(GLOBAL_KEY, gh.slice(-GLOBAL_MAX));
      }
      report.globalSnap = true;
    }catch(e){ report.errors.push('global:'+e.message); }
  }catch(e){ report.errors.push('journal:'+e.message); }

  return new Response(JSON.stringify({ ok:true, ...report,
    countries:Object.keys(signals).length, journalWrites, bootstrapping }), {
    status: 200, headers: { 'Content-Type':'application/json' },
  });
};

// Daily at 04:17 UTC (off-peak; IODA/er-api both refreshed by then)
export const config = { schedule: '17 4 * * *' };
