// netlify/functions/osint-journal.mjs
//
// Durable OSINT observation journal (Phase 2). Owner-only.
// Server-authored by the daily osint-ingest job → survives cache clears,
// queryable, accumulates without the owner ever opening the app.
//
// Auth: same Bearer pattern as other /api/admin/* endpoints.

import { getStore } from '@netlify/blobs';
import { checkBearerAuth } from './_lib/auth.mjs';

export default async (req) => {
  if(!checkBearerAuth(req)){
    return new Response('forbidden', { status: 403 });
  }
  try{
    const s = getStore({ name:'osint', consistency:'strong' });
    const journal = (await s.get('journal', { type:'json' })) || [];
    const missed  = (await s.get('missed',  { type:'json' })) || [];
    const globalHistory = (await s.get('global-history', { type:'json' })) || [];

    const url = new URL(req.url);
    const iso = url.searchParams.get('iso');
    const tier = url.searchParams.get('tier');
    let rows = journal;
    if(iso)  rows = rows.filter(r => r.iso2 === iso.toUpperCase());
    if(tier) rows = rows.filter(r => r.tier === tier);

    // ── Scorecard (closed-loop verification) ──
    const byTier = {};
    for(const r of journal) byTier[r.tier] = (byTier[r.tier]||0) + 1;
    const confirmed   = journal.filter(r => r.outcome === 'confirmed').length;
    const notConf     = journal.filter(r => r.outcome === 'not_confirmed').length;
    const opacityUnv  = journal.filter(r => r.outcome === 'opacity_unverifiable').length;
    const pending     = journal.filter(r => r.outcome == null).length;
    const scored      = confirmed + notConf;
    const leads       = journal.filter(r => r.lead_time_days != null).map(r => r.lead_time_days);
    const avgLead     = leads.length ? +(leads.reduce((a,b)=>a+b,0)/leads.length).toFixed(1) : null;

    return new Response(JSON.stringify({
      total: journal.length,
      scorecard: {
        byTier,
        confirmed, not_confirmed: notConf,
        opacity_unverifiable: opacityUnv, pending,
        precision: scored ? +(confirmed/scored).toFixed(3) : null,
        avg_lead_days: avgLead,
        // recall side — escalations we stayed silent on (false negatives)
        missed_total: missed.length,
        note: scored < 20
          ? 'n too small — directional only, not statistically trustworthy yet (need ~6–12mo)'
          : 'sufficient n for cautious weight calibration',
      },
      rows: rows.slice(-500),
      missed: missed.slice(-200),
      globalHistory: globalHistory.slice(-180),
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type':'application/json' },
    });
  }catch(e){
    return new Response(JSON.stringify({ error:e.message }), {
      status: 500, headers: { 'Content-Type':'application/json' },
    });
  }
};

export const config = { path: '/api/admin/osint-journal' };
