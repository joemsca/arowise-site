// Unit test for the client-portal middleware: per-login scopes. Run: node --test tests/middleware.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLIENT_PORTAL_SECRET = 'test-secret';
process.env.CLIENT_PORTAL_USERS = JSON.stringify([
  { user: 'dan', pass: 'dan-pass', clients: ['advanced-back-and-neck'] },
  { user: 'sapa', pass: 'sapa-pass', clients: ['sapa'] },
  { user: 'joe', pass: 'joe-pass', clients: ['*'] },
]);
process.env.CLIENT_PORTAL_USER = 'legacy';
process.env.CLIENT_PORTAL_PASS = 'legacy-pass';
const { default: middleware } = await import('../middleware.js');

const ORIGIN = 'https://arowise.com';
async function login(user, pass, next = '/clients/') {
  const body = new URLSearchParams({ user, pass, next });
  const res = await middleware(new Request(`${ORIGIN}/clients/login`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }));
  return res;
}
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const get = (path, cookie, method = 'GET') => middleware(new Request(`${ORIGIN}${path}`, { method, headers: cookie ? { cookie } : {} }));

test('unauthenticated GET redirects to login with next', async () => {
  const res = await get('/clients/sapa/website-design');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/clients/login?next=%2Fclients%2Fsapa%2Fwebsite-design');
});

test('wrong password is refused; the legacy single pair is ignored once CLIENT_PORTAL_USERS is set', async () => {
  assert.equal((await login('sapa', 'nope')).status, 401);
  assert.equal((await login('legacy', 'legacy-pass')).status, 401);
});

test('each login opens only its own client folder; joe opens everything', async () => {
  const dan = cookieOf(await login('dan', 'dan-pass'));
  const sapa = cookieOf(await login('sapa', 'sapa-pass'));
  const joe = cookieOf(await login('joe', 'joe-pass'));
  assert.equal(await get('/clients/advanced-back-and-neck/codebook', dan), undefined, 'dan -> ABN passes through');
  assert.equal((await get('/clients/sapa/website-design', dan)).status, 403, 'dan -> SAPA is forbidden');
  assert.equal(await get('/clients/sapa/website-design', sapa), undefined, 'sapa -> SAPA preview passes');
  assert.equal(await get('/clients/sapa/class-scheduler/r/sapa', sapa), undefined, 'sapa -> SAPA scheduler passes');
  assert.equal((await get('/clients/advanced-back-and-neck/codebook', sapa)).status, 403, 'sapa -> ABN is forbidden');
  assert.equal(await get('/clients/advanced-back-and-neck/codebook', joe), undefined);
  assert.equal(await get('/clients/sapa/website-design', joe), undefined);
  const forbidden = await get('/clients/sapa/website-design', dan);
  assert.match(await forbidden.text(), /signed in as <strong>dan<\/strong>/);
  assert.equal((await get('/clients/sapa/website-design/api', dan, 'POST')).status, 403);
});

test('a tampered cookie is treated as signed out', async () => {
  const sapa = cookieOf(await login('sapa', 'sapa-pass'));
  const forged = sapa.replace(/\.[^.]+$/, '.AAAA');
  assert.equal((await get('/clients/sapa/website-design', forged)).status, 302);
});

test('logout clears the cookie', async () => {
  const res = await get('/clients/logout');
  assert.equal(res.status, 303);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('the questionnaire opens only for a "*" login; client logins get 403, signed-out gets login', async () => {
  const sapa = cookieOf(await login('sapa', 'sapa-pass'));
  const joe = cookieOf(await login('joe', 'joe-pass', '/discovery-questionnaire'));
  const signedOut = await get('/discovery-questionnaire');
  assert.equal(signedOut.status, 302);
  assert.equal(signedOut.headers.get('location'), '/clients/login?next=%2Fdiscovery-questionnaire');
  assert.equal((await get('/discovery-questionnaire/api/state', null, 'PUT')).status, 401);
  assert.equal((await get('/discovery-questionnaire', sapa)).status, 403);
  assert.equal((await get('/discovery-questionnaire/api/list', sapa, 'POST')).status, 403);
  assert.equal(await get('/discovery-questionnaire', joe), undefined);
  assert.equal(await get('/discovery-questionnaire/api/state', joe, 'PUT'), undefined);
});

test('login sets the cookie on Path=/ and honors a questionnaire next; foreign next falls back', async () => {
  const res = await login('joe', 'joe-pass', '/discovery-questionnaire');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/discovery-questionnaire');
  assert.match(res.headers.get('set-cookie'), /Path=\/;/);
  assert.equal((await login('joe', 'joe-pass', '//evil.example/x')).headers.get('location'), '/clients/');
  assert.equal((await login('joe', 'joe-pass', '/clients/login')).headers.get('location'), '/clients/');
});

test('an old Path=/clients cookie alongside a bad one still counts; logout clears both paths', async () => {
  const joe = cookieOf(await login('joe', 'joe-pass'));
  assert.equal(await get('/clients/sapa/website-design', `aw_portal=garbage.sig; ${joe}`), undefined);
  const out = await get('/clients/logout');
  const cookies = out.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some((c) => /Path=\/clients;/.test(c)) && cookies.some((c) => /Path=\/;/.test(c)));
});

test('with CLIENT_PORTAL_USERS unset the legacy pair still works with full scope', async () => {
  delete process.env.CLIENT_PORTAL_USERS;
  const legacy = cookieOf(await login('legacy', 'legacy-pass'));
  assert.equal(await get('/clients/sapa/website-design', legacy), undefined);
  assert.equal(await get('/clients/advanced-back-and-neck/codebook', legacy), undefined);
});
