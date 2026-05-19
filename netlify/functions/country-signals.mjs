// netlify/functions/country-signals.mjs
//
// Serves the live OSINT feed produced by the daily `osint-ingest` job.
// If the Blob isn't populated yet (first deploy, before first cron run),
// returns 204 so the frontend transparently falls back to the committed
// static public/country-signals.json. Zero-risk rollout.

import { getStore } from '@netlify/blobs';

export default async () => {
  try{
    const s = getStore({ name: 'osint', consistency: 'strong' });
    const feed = await s.get('country-signals', { type: 'json' });
    if(!feed){
      return new Response(null, { status: 204 }); // → frontend uses static seed
    }
    return new Response(JSON.stringify(feed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // 1h browser cache, 6h SWR — feed only changes once a day anyway
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=21600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }catch(e){
    // Never hard-fail — frontend has the static fallback
    return new Response(null, { status: 204 });
  }
};

export const config = { path: '/api/country-signals' };
