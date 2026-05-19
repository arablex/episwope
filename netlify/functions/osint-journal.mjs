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

    const url = new URL(req.url);
    const iso = url.searchParams.get('iso');
    const tier = url.searchParams.get('tier');
    let rows = journal;
    if(iso)  rows = rows.filter(r => r.iso2 === iso.toUpperCase());
    if(tier) rows = rows.filter(r => r.tier === tier);

    // Summary for quick validation review
    const byTier = {};
    for(const r of journal) byTier[r.tier] = (byTier[r.tier]||0) + 1;
    const covert = journal.filter(r => r.tier === 'covert_elevated').length;
    const suppressed = journal.filter(r => r.opacitySuppressed).length;
    const pendingOutcome = journal.filter(r => r.outcome == null).length;

    return new Response(JSON.stringify({
      total: journal.length,
      summary: { byTier, covert, opacitySuppressed: suppressed, pendingOutcome },
      rows: rows.slice(-500),
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
