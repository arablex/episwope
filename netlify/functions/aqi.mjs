/**
 * WAQI air quality proxy — hides API token, adds 15-min cache.
 * Set WAQI_TOKEN env var in Netlify dashboard.
 * Free token: https://aqicn.org/data-platform/token/
 */
export default async (req) => {
  const url   = new URL(req.url);
  const lat1  = url.searchParams.get('lat1') || '-60';
  const lon1  = url.searchParams.get('lon1') || '-180';
  const lat2  = url.searchParams.get('lat2') || '75';
  const lon2  = url.searchParams.get('lon2') || '180';

  const token  = process.env.WAQI_TOKEN || 'demo';
  const apiUrl = `https://api.waqi.info/map/bounds/?latlng=${lat1},${lon1},${lat2},${lon2}&token=${token}`;

  try {
    const res  = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', message: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/aqi' };
