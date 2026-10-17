// Unit test for api/questionnaire.js with an in-memory fake of the Upstash REST pipeline and GitHub.
// Run: node --test tests/questionnaire.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.CLIENT_PORTAL_SECRET = 'test-secret';
process.env.CLIENT_PORTAL_USERS = JSON.stringify([{ user: 'joe', pass: 'x', clients: ['*'] }, { user: 'sapa', pass: 'y', clients: ['sapa'] }]);
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
process.env.UPSTASH_REDIS_REST_TOKEN = 't';
process.env.VAULT_GITHUB_TOKEN = 'g';

const kv = new Map(); const hashes = new Map(); const lists = new Map(); const ghFiles = new Map();
function run([cmd, key, ...a]) {
  switch (cmd) {
    case 'GET': return kv.get(key) ?? null;
    case 'SET': if (a.includes('NX') && kv.has(key)) return null; kv.set(key, a[0]); return 'OK';
    case 'HSET': { const h = hashes.get(key) || new Map(); h.set(a[0], a[1]); hashes.set(key, h); return 1; }
    case 'HGETALL': return [...(hashes.get(key) || new Map())].flat();
    case 'LPUSH': { const l = lists.get(key) || []; l.unshift(a[0]); lists.set(key, l); return l.length; }
    case 'LTRIM': { lists.set(key, (lists.get(key) || []).slice(a[0], a[1] + 1)); return 'OK'; }
    default: throw new Error('unexpected ' + cmd);
  }
}
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith('https://redis.example/pipeline')) {
    return new Response(JSON.stringify(JSON.parse(init.body).map((c) => ({ result: run(c) }))), { status: 200 });
  }
  const m = String(url).match(/contents\/(.+)$/);
  if (m) {
    const path = m[1];
    if ((init.method || 'GET') === 'GET') {
      if (path.endsWith('.html')) return new Response('<html><head></head><body>Q</body></html>', { status: 200 });
      return ghFiles.has(path) ? new Response(JSON.stringify({ sha: 'abc' }), { status: 200 }) : new Response('{}', { status: 404 });
    }
    ghFiles.set(path, JSON.parse(init.body)); return new Response('{}', { status: 201 });
  }
  throw new Error('unexpected fetch ' + url);
};
const { default: handler } = await import('../api/questionnaire.js');

const cookie = (user) => { const p = Buffer.from(`${user}|${Date.now() + 1e6}`).toString('base64url'); return `aw_portal=${p}.${createHmac('sha256', 'test-secret').update(p).digest('base64url')}`; };
async function call({ op, p, method = 'GET', body, user = 'joe' }) {
  const out = { status: 200, headers: {}, body: undefined };
  const res = {
    setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; }, send(b) { out.body = b; return this; }, end() { return this; },
  };
  await handler({ method, query: { op, ...(p ? { p } : {}) }, headers: user ? { cookie: cookie(user) } : {}, body }, res);
  return out;
}

test('signed out: page redirects to login, api is 401; a client login is 403', async () => {
  const page = await call({ op: 'page', user: null });
  assert.equal(page.status, 302);
  assert.equal(page.headers.location, '/clients/login?next=%2Fdiscovery-questionnaire');
  assert.equal((await call({ op: 'list', user: null })).status, 401);
  assert.equal((await call({ op: 'list', user: 'sapa' })).status, 403);
});

test('page is served from the vault with noindex and no-store', async () => {
  const r = await call({ op: 'page' });
  assert.equal(r.status, 200);
  assert.match(r.body, /noindex,nofollow/);
  assert.equal(r.headers['cache-control'], 'private, no-store');
});

test('save, load, list; an older edit is refused with 409', async () => {
  const st = { v: 2, name: 'Acme Widgets', updated: 2000, checks: { a: 1 }, vals: {}, notes: { a: 'uses QuickBooks' }, catNotes: {} };
  assert.equal((await call({ op: 'state', p: 'acme-widgets', method: 'PUT', body: st })).status, 200);
  const got = await call({ op: 'state', p: 'acme-widgets' });
  assert.equal(got.body.state.notes.a, 'uses QuickBooks');
  const stale = await call({ op: 'state', p: 'acme-widgets', method: 'PUT', body: { ...st, updated: 1000, notes: {} } });
  assert.equal(stale.status, 409);
  assert.equal((await call({ op: 'state', p: 'acme-widgets' })).body.state.notes.a, 'uses QuickBooks');
  const list = await call({ op: 'list' });
  assert.deepEqual(list.body.prospects.map((x) => [x.slug, x.name, x.checked]), [['acme-widgets', 'Acme Widgets', 1]]);
});

test('a save that empties the record always snapshots the previous version first', async () => {
  const before = (lists.get('dq:hist:acme-widgets') || []).length;
  const r = await call({ op: 'state', p: 'acme-widgets', method: 'PUT', body: { v: 2, name: 'Acme Widgets', updated: 3000, checks: {}, vals: {}, notes: {}, catNotes: {} } });
  assert.equal(r.status, 200);
  const hist = lists.get('dq:hist:acme-widgets');
  assert.equal(hist.length, before + 1);
  assert.equal(JSON.parse(hist[0]).notes.a, 'uses QuickBooks');
});

test('bad slug and bad body are rejected; file commits into the vault responses folder', async () => {
  assert.equal((await call({ op: 'state', p: '../etc' })).status, 400);
  assert.equal((await call({ op: 'state', p: 'x', method: 'PUT', body: 'not json' })).status, 400);
  const f = await call({ op: 'file', p: 'acme-widgets', method: 'POST', body: { schema_version: 2, prospect: 'Acme Widgets', selected: [] } });
  assert.equal(f.status, 200);
  assert.equal(f.body.filed, '20-Internal-Projects/discovery-questionnaire/responses/acme-widgets.json');
  const put = ghFiles.get(f.body.filed);
  assert.equal(JSON.parse(Buffer.from(put.content, 'base64').toString()).filed_by, 'joe');
});
