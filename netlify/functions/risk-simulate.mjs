/**
 * /api/v1/simulate — What-If force-majeure cascade (Enterprise).
 *
 *   GET  ?country=CN&category=transport&severity=5&hops=3
 *   POST { country, category, severity, hops }
 *
 * Analyst drops a synthetic trigger; we cascade it across the curated
 * exposure graph (land adjacency + logistics corridors) and recompute
 * each impacted geography's Composite Risk. SANDBOXED: read-only,
 * nothing is written to the live index. Scenario model — directional,
 * not a forecast.
 *
 * Spec: docs/specs/2026-05-17-predictive-risk-intelligence.md §4
 */
const CORS = { 'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type' };
const J = (o, s = 200, x = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, ...x } });

const CATS = ['health','conflict','civil_unrest','transport',
  'border','infrastructure','climate'];
const BANDS = ['minimal','low','moderate','elevated','severe','critical'];
const bandFor = (s) => BANDS[Math.min(Math.round(s), 5)];

// Category transmissibility by edge type (0–1).
const TRANS = {
  land:     {conflict:0.90,civil_unrest:0.80,border:0.75,health:0.70,
             infrastructure:0.45,transport:0.40,climate:0.45},
  trade:    {transport:0.90,infrastructure:0.85,border:0.55,conflict:0.40,
             civil_unrest:0.20,health:0.20,climate:0.20},
  maritime: {transport:0.95,infrastructure:0.80,border:0.50,conflict:0.35,
             civil_unrest:0.15,health:0.15,climate:0.20},
  air:      {transport:0.70,health:0.70,border:0.60,conflict:0.30,
             infrastructure:0.30,civil_unrest:0.20,climate:0.15},
};
const HOP_LAG = { land:4, trade:2, maritime:2, air:1 }; // days/hop
const DECAY = 0.55;

const clip = (v, lo = 0, hi = 5) => Math.max(lo, Math.min(hi, v));

// Composite — mirrors risk_scoring.compose (max-dominant + weighted tail).
function compose(catScores) {
  const r = Object.entries(catScores).sort((a, b) => b[1] - a[1]);
  if (!r.length) return { score: 0, band: 'minimal', dominant_category: null };
  const top = r[0][1];
  let tail = 0;
  r.slice(1).forEach(([, s], i) => { tail += (i===0?0.45:i===1?0.20:0.08) * s; });
  let c = top + Math.min(tail, 5 - top) * 0.6;
  if (r.filter(([, s]) => s >= 3).length >= 2) c *= 1.15;
  c = Math.round(clip(c) * 100) / 100;
  return { score: c, band: bandFor(c), dominant_category: r[0][1] > 0 ? r[0][0] : null };
}

let _g = { at: 0, graph: null, idx: null };
async function load(origin) {
  if (Date.now() - _g.at < 60000 && _g.graph) return _g;
  const [g, i] = await Promise.all([
    fetch(`${origin}/public/exposure_graph.json`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${origin}/public/risk_index.json`).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  if (g && i) _g = { at: Date.now(), graph: g, idx: i };
  return _g;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  let p;
  if (req.method === 'POST') {
    try { p = await req.json(); } catch { return J({ error: 'invalid_json' }, 400); }
  } else {
    const q = new URL(req.url).searchParams;
    p = { country: q.get('country'), category: q.get('category'),
          severity: q.get('severity'), hops: q.get('hops') };
  }
  const trig = String(p.country || '').toUpperCase().slice(0, 2);
  const cat = String(p.category || 'transport').toLowerCase();
  const sev = Math.max(0.5, Math.min(5, Number(p.severity) || 4));
  const maxHop = Math.max(1, Math.min(3, parseInt(p.hops, 10) || 3));
  if (!/^[A-Z]{2}$/.test(trig)) return J({ error: 'country (ISO-2) required' }, 400);
  if (!CATS.includes(cat)) return J({ error: `category one of ${CATS.join(',')}` }, 400);

  const origin = new URL(req.url).origin;
  const { graph, idx } = await load(origin);
  if (!graph || !idx) return J({ error: 'simulation_data_unavailable' }, 503);

  // BFS diffusion of the category delta across the exposure graph
  const delta = {};           // iso → added category-score delta
  const via = {};             // iso → {hop, from, type}
  delta[trig] = sev;
  via[trig] = { hop: 0, from: null, type: 'origin' };
  let frontier = [trig];
  for (let hop = 1; hop <= maxHop; hop++) {
    const next = [];
    for (const i of frontier) {
      const di = delta[i];
      for (const e of (graph.edges[i] || [])) {
        const tr = (TRANS[e.type] || TRANS.land)[cat] || 0;
        const add = di * e.w * Math.pow(DECAY, hop) * tr;
        if (add < 0.05) continue;
        delta[e.to] = (delta[e.to] || 0) + add;
        if (!via[e.to] || hop < via[e.to].hop) {
          via[e.to] = { hop, from: i, type: e.type };
          next.push(e.to);
        }
      }
    }
    frontier = [...new Set(next)];
    if (!frontier.length) break;
  }

  // recompute composite per impacted node (sandboxed; baseline read-only)
  const impacted = [];
  for (const iso of Object.keys(delta)) {
    const node = idx.index[iso];
    const baseCB = (node && node.category_breakdown) || {};
    const baseScores = {};
    CATS.forEach(c => { baseScores[c] = (baseCB[c] && baseCB[c].score) || 0; });
    const baseComp = (node && node.composite_risk && node.composite_risk.score) || 0;
    const scen = { ...baseScores };
    scen[cat] = clip(scen[cat] + delta[iso]);
    const nc = compose(scen);
    const dC = Math.round((nc.score - baseComp) * 100) / 100;
    if (dC < 0.05 && iso !== trig) continue;
    const v = via[iso];
    impacted.push({
      country: iso, hop: v.hop, via: v.from, link: v.type,
      baseline: Math.round(baseComp * 100) / 100,
      projected: nc.score, delta: dC, band: nc.band,
      eta_days: v.hop === 0 ? 0 : v.hop * (HOP_LAG[v.link] || 3),
      category_delta: Math.round(delta[iso] * 100) / 100,
    });
  }
  impacted.sort((a, b) => b.delta - a.delta || a.hop - b.hop);

  const corridorsHit = Object.entries(graph.corridors || {})
    .filter(([, c]) => c.hub === trig || (c.members || []).includes(trig))
    .map(([id, c]) => ({ id, name: c.name, type: c.type, hub: c.hub }));

  return J({
    api_version: '1.0',
    model: 'exposure-graph cascade v0 — scenario simulation, directional not a forecast',
    sandboxed: true,
    trigger: { country: trig, category: cat, severity: sev, hops: maxHop },
    impacted_count: impacted.length,
    corridors_at_risk: corridorsHit,
    impacted,
    meta: { graph: graph.meta?.model, generated_at: new Date().toISOString() },
  }, 200, { 'Cache-Control': 'public, s-maxage=120' });
};

export const config = { path: '/api/v1/simulate' };
