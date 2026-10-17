// Edge Middleware: the client portal gate for /clients/* and for Joe's own /discovery-questionnaire.
// A branded login page (GET /clients/login) sets a signed, HttpOnly session cookie;
// every other /clients/* request must carry a valid cookie or is redirected to login.
//
// Accounts: CLIENT_PORTAL_USERS is a JSON array, one entry per login, each scoped to the client
// folders it may open:  [{"user":"sapa","pass":"...","clients":["sapa"]}, {"user":"joe","pass":"...","clients":["*"]}]
// A login whose cookie is valid but whose scope does not cover /clients/<slug>/... gets a 403 page, not the content.
// Legacy: if CLIENT_PORTAL_USERS is unset, the single CLIENT_PORTAL_USER / CLIENT_PORTAL_PASS pair is used with scope "*".
// CLIENT_PORTAL_SECRET is the HMAC key for the cookie.
// /discovery-questionnaire is not a client folder: it is AroWise's own tool and opens only for a "*" login.
// The cookie is set on Path=/ so it reaches both trees; sessions issued before that carry Path=/clients
// and keep working there until they expire (logout clears both).
export const config = { matcher: ['/clients/:path*', '/discovery-questionnaire', '/discovery-questionnaire/:path*'] };

const COOKIE = 'aw_portal';
const DAYS = 30;

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

function accounts() {
  const raw = process.env.CLIENT_PORTAL_USERS;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.filter((a) => a && typeof a.user === 'string' && typeof a.pass === 'string' && a.pass.length > 0).map((a) => ({ user: a.user, pass: a.pass, clients: Array.isArray(a.clients) && a.clients.length ? a.clients : [] }));
    } catch { /* malformed: fail closed, nobody signs in */ }
    return [];
  }
  if (process.env.CLIENT_PORTAL_USER && process.env.CLIENT_PORTAL_PASS) return [{ user: process.env.CLIENT_PORTAL_USER, pass: process.env.CLIENT_PORTAL_PASS, clients: ['*'] }];
  return [];
}

const OWNER_ONLY = Symbol('owner-only');
const isQuestionnaire = (path) => /^\/discovery-questionnaire(\/|$)/.test(path);

/** The client slug a /clients/... path belongs to, null for shared routes (login, logout, the bare /clients/),
 *  or OWNER_ONLY for the questionnaire. */
function clientOf(path) {
  if (isQuestionnaire(path)) return OWNER_ONLY;
  const m = path.match(/^\/clients\/([^/]+)/);
  if (!m || m[1] === 'login' || m[1] === 'logout') return null;
  return m[1];
}

function allowed(account, slug) {
  if (!account) return false;
  if (slug === null) return true;
  if (slug === OWNER_ONLY) return account.clients.includes('*');
  return account.clients.includes('*') || account.clients.includes(slug);
}

async function sign(payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.CLIENT_PORTAL_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

// A browser can hold two aw_portal cookies (an old Path=/clients one and a Path=/ one); any valid one counts.
async function validSession(request) {
  const raws = (request.headers.get('cookie') || '').split(/;\s*/).filter((c) => c.startsWith(COOKIE + '='));
  for (const raw of raws) {
    const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
    if (!payload || !sig) continue;
    if ((await sign(payload)) !== sig) continue;
    const [user, exp] = b64uDecode(payload).split('|');
    if (user && Number(exp) >= Date.now()) return user;
  }
  return null;
}

const safeNext = (next) => ((next.startsWith('/clients/') && !next.startsWith('/clients/login')) || isQuestionnaire(next) ? next : '/clients/');

const STYLE = `
:root{--canvas:#141615;--surface:#1B1D1C;--raised:#232624;--border:#2D2D2D;--border2:#3B3F40;--text:#E8E4DD;--muted:#ADBFC7;--teal:#00C6CB;--teal-deep:#00514C;--red:#F24A1C}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--canvas);color:var(--text);font:16px/1.5 "Space Grotesk",system-ui,sans-serif;display:grid;place-items:center;padding:24px}
.brand{display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:var(--text)}.brand img{width:30px;height:30px}
.wordmark{font-weight:700;font-size:1.3rem;letter-spacing:-.03em;white-space:nowrap}.wordmark span{color:var(--teal)}
.card{width:min(420px,100%);background:var(--surface);border:1px solid var(--border);padding:32px 30px 28px;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);position:relative}
.kicker{font:500 .72rem/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:26px 0 8px;display:flex;justify-content:space-between}
h1{font-size:1.35rem;font-weight:500;margin:0 0 18px;letter-spacing:-.01em}
p{margin:0 0 14px}
label{display:block;font:500 .72rem/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
input{width:100%;background:var(--canvas);border:1px solid var(--border2);color:var(--text);padding:11px 12px;font:inherit;outline:none}
input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,198,203,.18)}
button,.btn{margin-top:22px;width:100%;display:block;text-align:center;text-decoration:none;background:var(--teal);color:#0b1413;border:0;padding:13px 16px;font:700 .95rem "Space Grotesk",sans-serif;letter-spacing:.02em;cursor:pointer;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
button:hover,.btn:hover{filter:brightness(1.08)}.err{color:var(--red);font-size:.9rem;margin:12px 0 0}
.foot{margin-top:18px;font:.72rem/1.4 "JetBrains Mono",monospace;color:var(--muted);letter-spacing:.06em}
.mark{position:absolute;right:16px;top:16px;width:14px;height:14px;border-top:1px solid var(--muted);border-right:1px solid var(--muted);opacity:.7}
`;

const head = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#141615"><title>${title} · AroWise Automation</title>
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>`;

const brand = `<span class="mark" aria-hidden="true"></span><a class="brand" href="/"><img src="/assets/arowise-icon-200.png" alt=""><span class="wordmark">Aro<span>Wise</span> Automation</span></a>`;

function page({ error = '', next = '' } = {}) {
  return `${head('Sign in')}
<form class="card" method="post" action="/clients/login" autocomplete="on">
  ${brand}
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

function forbidden(user, path) {
  return `${head('No access')}
<div class="card">
  ${brand}
  <div class="kicker"><span>Client portal</span><span>No access</span></div>
  <h1>This login cannot open that page</h1>
  <p>You are signed in as <strong>${user.replace(/[<>&]/g, '')}</strong>, which does not have access to <code>${path.replace(/[<>&"]/g, '')}</code>.</p>
  <a class="btn" href="/clients/logout">Sign out and use another login</a>
  <p class="foot">If you think you should have access, text Joe.</p>
</div></body></html>`;
}

const html = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...headers } });

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');

  if (path === '/clients/logout') {
    const headers = new Headers({ Location: '/clients/login' });
    headers.append('Set-Cookie', `${COOKIE}=; Path=/clients; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    headers.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return new Response(null, { status: 303, headers });
  }

  if (path === '/clients/login') {
    if (request.method === 'POST') {
      const form = await request.formData();
      const user = String(form.get('user') || '').trim();
      const pass = String(form.get('pass') || '');
      const next = safeNext(String(form.get('next') || ''));
      const account = accounts().find((a) => a.user === user && a.pass === pass);
      if (account) {
        const payload = b64u(enc.encode(`${user}|${Date.now() + DAYS * 864e5}`));
        const cookie = `${COOKIE}=${payload}.${await sign(payload)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
        return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
      }
      return html(page({ error: 'That username and password did not match.', next }), 401);
    }
    return html(page({ next: safeNext(url.searchParams.get('next') || '') }));
  }

  const user = await validSession(request);
  if (user) {
    const account = accounts().find((a) => a.user === user);
    if (allowed(account, clientOf(path))) return; // fall through to the static page / function / rewrite
    if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    return html(forbidden(user, url.pathname), 403);
  }
  const loc = `/clients/login?next=${encodeURIComponent(url.pathname)}`;
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  return new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'no-store' } });
}
