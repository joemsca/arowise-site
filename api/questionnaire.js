// Serverless function: the hosted discovery questionnaire at arowise.com/discovery-questionnaire.
// Joe's own tool, so only a portal login whose scope is "*" may use it (client logins get 403).
// The edge middleware gates the /discovery-questionnaire paths first; the session and scope are
// verified again here because /api/questionnaire is also reachable directly.
//
// Routes (vercel.json rewrites):
//   GET  /discovery-questionnaire                 -> op=page   the page, read live from the private vault
//   GET  /discovery-questionnaire/api/list        -> op=list   saved prospects, newest first
//   GET  /discovery-questionnaire/api/state?p=x   -> op=state  one prospect's saved answers
//   PUT  /discovery-questionnaire/api/state?p=x   -> op=state  save; an older `updated` than the stored one is refused (409)
//   POST /discovery-questionnaire/api/file?p=x    -> op=file   commit the Export JSON into the vault
//
// Storage: Upstash Redis (the store the flyer demo already uses). Keys:
//   dq:state:<slug>  the latest answers (no TTL)
//   dq:index         hash slug -> {name, updated, checked}
//   dq:hist:<slug>   list, newest first, capped at 50: a snapshot at most every 5 min while editing,
//                    and always before a save that empties the record (the Reset button)
// Env: CLIENT_PORTAL_SECRET, CLIENT_PORTAL_USERS, UPSTASH_REDIS_REST_URL/_TOKEN (or KV_REST_API_*),
//      VAULT_GITHUB_TOKEN (read + contents:write on joemsca/arowise).
import { createHmac } from 'node:crypto';
import { redisEnv } from '../lib/log.js';

const VAULT_REPO = 'joemsca/arowise';
const PAGE_PATH = 'skills/automation_services_catalog/assets/discovery-questionnaire.html';
const FILE_DIR = '20-Internal-Projects/discovery-questionnaire/responses';
const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const MAX_BYTES = 600000;
const PAGE_TTL_MS = 60000;
let pageCache = null; // { html, at } per warm instance

function sessionUser(req) {
  const raws = (req.headers.cookie || '').split(/;\s*/).filter((c) => c.startsWith('aw_portal='));
  for (const raw of raws) {
    const [payload, sig] = raw.slice('aw_portal='.length).split('.');
    if (!payload || !sig) continue;
    const expected = createHmac('sha256', process.env.CLIENT_PORTAL_SECRET || '').update(payload).digest('base64url');
    if (expected !== sig) continue;
    const [user, exp] = Buffer.from(payload, 'base64url').toString().split('|');
    if (user && Number(exp) > Date.now()) return user;
  }
  return null;
}

/** True only for a login listed in CLIENT_PORTAL_USERS with scope "*". Malformed config fails closed. */
function isOwner(user) {
  try {
    const list = JSON.parse(process.env.CLIENT_PORTAL_USERS || '[]');
    return Array.isArray(list) && list.some((a) => a && a.user === user && Array.isArray(a.clients) && a.clients.includes('*'));
  } catch { return false; }
}

async function pipeline(commands) {
  const env = redisEnv();
  if (!env) throw new Error('redis env missing');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(`${env.url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands), signal: ctl.signal });
    const out = await r.json();
    if (!r.ok || !Array.isArray(out)) throw new Error(`redis http ${r.status}`);
    const bad = out.find((x) => x && x.error);
    if (bad) throw new Error(bad.error);
    return out.map((x) => x.result);
  } finally { clearTimeout(timer); }
}

const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${VAULT_REPO}/contents/${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${process.env.VAULT_GITHUB_TOKEN}`, 'User-Agent': 'arowise-questionnaire', Accept: 'application/vnd.github+json', ...(init.headers || {}) },
});

const isEmpty = (s) => !s || (!Object.keys(s.checks || {}).length && !Object.keys(s.vals || {}).length && !Object.keys(s.notes || {}).length && !Object.keys(s.catNotes || {}).length);

function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return null; } }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

async function page(res) {
  if (!pageCache || Date.now() - pageCache.at > PAGE_TTL_MS) {
    const r = await gh(PAGE_PATH, { headers: { Accept: 'application/vnd.github.raw' } });
    if (!r.ok) {
      if (pageCache) return sendPage(res, pageCache.html); // serve the last good copy rather than nothing
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(502).send(`Could not read the questionnaire from the vault (GitHub ${r.status}).`);
    }
    pageCache = { html: await r.text(), at: Date.now() };
  }
  return sendPage(res, pageCache.html);
}

function sendPage(res, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(200).send(html.replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">'));
}

async function saveState(req, res, slug) {
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'bad json' });
  const json = JSON.stringify(body);
  if (json.length > MAX_BYTES) return res.status(413).json({ error: 'too large' });
  const updated = Number(body.updated) || Date.now();
  const [curRaw] = await pipeline([['GET', `dq:state:${slug}`]]);
  let cur = null; try { cur = curRaw ? JSON.parse(curRaw) : null; } catch { cur = null; }
  if (cur && Number(cur.updated) > updated) return res.status(409).json({ error: 'stale', updated: cur.updated });

  const cmds = [];
  if (cur && !isEmpty(cur)) {
    const [lock] = await pipeline([['SET', `dq:histlock:${slug}`, '1', 'NX', 'EX', 300]]);
    if (lock === 'OK' || isEmpty(body)) cmds.push(['LPUSH', `dq:hist:${slug}`, curRaw], ['LTRIM', `dq:hist:${slug}`, 0, 49]);
  }
  const name = String(body.name || slug).slice(0, 120);
  cmds.push(['SET', `dq:state:${slug}`, json],
    ['HSET', 'dq:index', slug, JSON.stringify({ name, updated, checked: Object.keys(body.checks || {}).length })]);
  await pipeline(cmds);
  return res.status(200).json({ ok: true, updated });
}

async function fileToVault(req, res, slug, user) {
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'bad json' });
  const path = `${FILE_DIR}/${slug}.json`;
  const content = Buffer.from(JSON.stringify({ ...body, filed_by: user, filed: new Date().toISOString() }, null, 2)).toString('base64');
  if (content.length > MAX_BYTES * 1.4) return res.status(413).json({ error: 'too large' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await gh(path);
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const put = await gh(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `discovery questionnaire: ${body.prospect || slug}`, content, ...(sha ? { sha } : {}) }) });
    if (put.ok) return res.status(200).json({ ok: true, filed: path });
    if (put.status !== 409 && put.status !== 422) return res.status(502).json({ error: `GitHub ${put.status}`, detail: (await put.text()).slice(0, 300) });
  }
  return res.status(502).json({ error: 'GitHub refused the update twice (file changed underneath)' });
}

export default async function handler(req, res) {
  const user = sessionUser(req);
  const op = String(req.query.op || '');
  if (!user) {
    if (op === 'page' && req.method === 'GET') { res.setHeader('Location', '/clients/login?next=%2Fdiscovery-questionnaire'); return res.status(302).end(); }
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!isOwner(user)) return res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  try {
    if (op === 'page') return req.method === 'GET' ? await page(res) : res.status(405).json({ error: 'GET only' });

    if (op === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
      const [flat] = await pipeline([['HGETALL', 'dq:index']]);
      const prospects = [];
      for (let i = 0; i + 1 < (flat || []).length; i += 2) {
        try { prospects.push({ slug: flat[i], ...JSON.parse(flat[i + 1]) }); } catch { prospects.push({ slug: flat[i], name: flat[i] }); }
      }
      prospects.sort((a, b) => (b.updated || 0) - (a.updated || 0));
      return res.status(200).json({ prospects });
    }

    const slug = String(req.query.p || '');
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'bad prospect' });

    if (op === 'state') {
      if (req.method === 'GET') {
        const [raw] = await pipeline([['GET', `dq:state:${slug}`]]);
        let state = null; try { state = raw ? JSON.parse(raw) : null; } catch { state = null; }
        return res.status(200).json({ state });
      }
      if (req.method === 'PUT' || req.method === 'POST') return await saveState(req, res, slug);
      return res.status(405).json({ error: 'GET or PUT' });
    }

    if (op === 'file') return req.method === 'POST' ? await fileToVault(req, res, slug, user) : res.status(405).json({ error: 'POST only' });

    return res.status(404).json({ error: 'unknown op' });
  } catch (e) {
    return res.status(502).json({ error: 'storage unavailable', detail: String(e.message || e).slice(0, 200) });
  }
}
