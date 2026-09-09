// Edge Middleware: the client portal gate for /clients/*.
// A branded login page (GET /clients/login) sets a signed, HttpOnly session cookie;
// every other /clients/* request must carry a valid cookie or is redirected to login.
// Env: CLIENT_PORTAL_USER, CLIENT_PORTAL_PASS, CLIENT_PORTAL_SECRET (HMAC key).
export const config = { matcher: ['/clients/:path*'] };

const COOKIE = 'aw_portal';
const DAYS = 30;

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function sign(payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.CLIENT_PORTAL_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

async function validSession(request) {
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return null;
  if ((await sign(payload)) !== sig) return null;
  const [user, exp] = b64uDecode(payload).split('|');
  if (!user || Number(exp) < Date.now()) return null;
  return user;
}

function page({ error = '', next = '' } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#141615"><title>Sign in · AroWise Automation</title>
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--canvas:#141615;--surface:#1B1D1C;--raised:#232624;--border:#2D2D2D;--border2:#3B3F40;--text:#E8E4DD;--muted:#ADBFC7;--teal:#00C6CB;--teal-deep:#00514C;--red:#F24A1C}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--canvas);color:var(--text);font:16px/1.5 "Space Grotesk",system-ui,sans-serif;display:grid;place-items:center;padding:24px}
.brand{display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:var(--text)}.brand img{width:30px;height:30px}
.wordmark{font-weight:700;font-size:1.3rem;letter-spacing:-.03em;white-space:nowrap}.wordmark span{color:var(--teal)}
.card{width:min(420px,100%);background:var(--surface);border:1px solid var(--border);padding:32px 30px 28px;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);position:relative}
.kicker{font:500 .72rem/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:26px 0 8px;display:flex;justify-content:space-between}
h1{font-size:1.35rem;font-weight:500;margin:0 0 18px;letter-spacing:-.01em}
label{display:block;font:500 .72rem/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
input{width:100%;background:var(--canvas);border:1px solid var(--border2);color:var(--text);padding:11px 12px;font:inherit;outline:none}
input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,198,203,.18)}
button{margin-top:22px;width:100%;background:var(--teal);color:#0b1413;border:0;padding:13px 16px;font:700 .95rem "Space Grotesk",sans-serif;letter-spacing:.02em;cursor:pointer;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
button:hover{filter:brightness(1.08)}.err{color:var(--red);font-size:.9rem;margin:12px 0 0}
.foot{margin-top:18px;font:.72rem/1.4 "JetBrains Mono",monospace;color:var(--muted);letter-spacing:.06em}
.mark{position:absolute;right:16px;top:16px;width:14px;height:14px;border-top:1px solid var(--muted);border-right:1px solid var(--muted);opacity:.7}
</style></head><body>
<form class="card" method="post" action="/clients/login" autocomplete="on">
  <span class="mark" aria-hidden="true"></span>
  <a class="brand" href="/"><img src="/assets/arowise-icon-200.png" alt=""><span class="wordmark">Aro<span>Wise</span> Automation</span></a>
  <div class="kicker"><span>Client portal</span><span>Secure</span></div>
  <h1>Sign in to continue</h1>
  <input type="hidden" name="next" value="${next.replace(/"/g, '')}">
  <label for="u">Username</label><input id="u" name="user" autocapitalize="off" autocorrect="off" spellcheck="false" required>
  <label for="p">Password</label><input id="p" name="pass" type="password" required>
  ${error ? `<p class="err">${error}</p>` : ''}
  <button type="submit">Sign in</button>
  <p class="foot">Private workspace for AroWise clients. Sessions last 30 days on this device.</p>
</form></body></html>`;
}

const html = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...headers } });

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');

  if (path === '/clients/logout') {
    return new Response(null, { status: 303, headers: { Location: '/clients/login', 'Set-Cookie': `${COOKIE}=; Path=/clients; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  if (path === '/clients/login') {
    if (request.method === 'POST') {
      const form = await request.formData();
      const user = String(form.get('user') || '').trim();
      const pass = String(form.get('pass') || '');
      let next = String(form.get('next') || '');
      if (!next.startsWith('/clients/') || next.startsWith('/clients/login')) next = '/clients/';
      if (process.env.CLIENT_PORTAL_PASS && user === process.env.CLIENT_PORTAL_USER && pass === process.env.CLIENT_PORTAL_PASS) {
        const payload = b64u(enc.encode(`${user}|${Date.now() + DAYS * 864e5}`));
        const cookie = `${COOKIE}=${payload}.${await sign(payload)}; Path=/clients; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
        return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
      }
      return html(page({ error: 'That username and password did not match.', next }), 401);
    }
    return html(page({ next: url.searchParams.get('next') || '' }));
  }

  if (await validSession(request)) return; // fall through to the static page / function
  const loc = `/clients/login?next=${encodeURIComponent(url.pathname)}`;
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  return new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'no-store' } });
}
