// netlify/functions/devlogin.mjs
//
// Passphrase-gated dev login. Replaces the public static dev-login.html.
//
// HONEST scope: this is obscurity hardening, NOT real auth. The fake
// alg:none JWT it sets is still forgeable in the console by anyone who
// reads globe.js. What this DOES fix: a random visitor can no longer
// one-click "B2B Admin" — they need ?k=<DEV_PASSPHRASE> (server-checked
// against an env var, constant-time). Real superuser protection of the
// accumulated asset is the Bearer-gated /api/admin/* endpoints.
//
// Access:  /internal/devlogin?k=<DEV_PASSPHRASE>
// Set env: DEV_PASSPHRASE (long random string, Netlify env)

import { timingSafeEqual } from 'node:crypto';

function ok(got, expected){
  if(!expected || !got) return false;
  const a = Buffer.from(String(got), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if(a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="robots" content="noindex,nofollow"><title>·</title><style>
body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
background:#0D1015;font-family:'Geist',system-ui,sans-serif;color:#fff}
.card{background:#13171D;border:1px solid rgba(255,255,255,.08);border-radius:18px;
padding:40px 36px;width:340px;text-align:center}
.logo{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px}
.sub{font-size:13px;color:#6B7280;margin-bottom:28px}
.btn{display:block;width:100%;padding:13px;border:none;border-radius:11px;font-size:14px;
font-weight:700;cursor:pointer;margin-bottom:10px;transition:opacity .15s}
.btn:hover{opacity:.88}.btn-admin{background:#E8590C;color:#fff}
.btn-pro{background:#1F2937;color:#fff;border:1px solid rgba(255,255,255,.12)}
.btn-free{background:#1F2937;color:#6B7280;border:1px solid rgba(255,255,255,.07)}
.note{font-size:11px;color:#374151;margin-top:20px}</style></head><body>
<div class="card"><div class="logo">
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" style="display:inline;vertical-align:middle;margin-right:8px"><rect width="28" height="28" rx="7" fill="#E8590C"/><path d="M7.5 8 L14 20 L20.5 8" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
Vigilo Dev</div><div class="sub">Choose a role to preview the dashboard</div>
<button class="btn btn-admin" onclick="login('admin')">✦ Pro · B2B Admin</button>
<button class="btn btn-pro" onclick="login('pro')">✦ Pro · Individual</button>
<button class="btn btn-free" onclick="login('free')">Free user</button>
<div class="note">Dev only · not indexed · resets on clear storage</div></div>
<script>
function login(role){
  var profiles={
    admin:{email:'alex@vigilo.cc',plan:'pro',b2b_role:'b2b_admin',company_id:'vigilo-internal',exp:9999999999},
    pro:{email:'alex@vigilo.cc',plan:'pro',exp:9999999999},
    free:{email:'alex@vigilo.cc',plan:'free',exp:9999999999}
  };
  var p=profiles[role];
  var b64=btoa(JSON.stringify(p)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=/g,'');
  localStorage.setItem('vigilo_jwt','eyJhbGciOiJub25lIn0.'+b64+'.sig');
  localStorage.setItem('vigilo_api_key','vgl_dev_xK9mP2qRtL8nVw3jZ5yA');
  localStorage.setItem('vigilo_assess_left','10');
  localStorage.setItem('vigilo_watched',JSON.stringify(['United States','Thailand','Germany','Japan','Brazil','United Arab Emirates','Singapore']));
  localStorage.setItem('vigilo_reports',JSON.stringify([
    {country:'TH',type:'Traveler',date:new Date(Date.now()-86400000*2).toISOString()},
    {country:'DE',type:'Business Trip',date:new Date(Date.now()-86400000*5).toISOString()},
    {country:'JP',type:'Traveler',date:new Date(Date.now()-86400000*9).toISOString()}
  ]));
  if(role==='admin'){
    localStorage.setItem('vigilo_osint','1');
    localStorage.setItem('vigilo_company',JSON.stringify({name:'Vigilo Internal',available_credits:500,
      members:[{email:'alex@vigilo.cc',b2b_role:'b2b_admin'},{email:'partner@acme.com',b2b_role:'b2b_employee'},{email:'ops@globaltravel.io',b2b_role:'b2b_employee'}]}));
  } else { localStorage.removeItem('vigilo_company'); }
  localStorage.removeItem('vigilo_onboarding_done');
  window.location.href='/account';
}
</script></body></html>`;

export default async (req) => {
  const url = new URL(req.url);
  const k = url.searchParams.get('k');
  if(!ok(k, process.env.DEV_PASSPHRASE)){
    return new Response('Not found', { status: 404 });
  }
  return new Response(PAGE, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
};

export const config = { path: '/internal/devlogin' };
