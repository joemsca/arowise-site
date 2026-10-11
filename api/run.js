// POST /api/run: path A, "screenshot your to-do list" (spec 4.6). JSON body {image (base64), media_type,
// spot, turnstile}. Streams Server-Sent Events: one {step, label, done} per completed server step,
// then {result_id}. The image lives in this function's memory for the duration of the vision call
// and is never written anywhere: not Redis, not logs, not the result document.
// Gates, in order: method, live mode (production needs mode=demo), Turnstile, image checks, caps.
// Every failure is an SSE {error} the page turns into a retry or a booking button.
import { loadConfig } from '../lib/config.js';
import { logEvent, visitorFromCookie } from '../lib/log.js';
import { checkLlmCaps, ipHash, clientIp } from '../lib/ratelimit.js';
import { extractTasks, matchTasks, usageCost } from '../lib/anthropic.js';
import { saveResult, newId } from '../lib/results.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { COPY } from '../lib/copy.js';

export const config = { supportsResponseStreaming: true, maxDuration: 120 };

const SPOT_RE = /^[a-z0-9-]{1,40}$/;
const TYPES = { 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/webp': [0x52, 0x49, 0x46, 0x46] };
const MAX_B64 = 4 * 1024 * 1024 * 4 / 3; // 4 MB of image, base64-expanded (Vercel's body limit is 4.5 MB)

function imageOk(b64, type) {
  const magic = TYPES[type];
  if (!magic || typeof b64 !== 'string' || b64.length < 100 || b64.length > MAX_B64) return false;
  let head;
  try { head = Buffer.from(b64.slice(0, 32), 'base64'); } catch { return false; }
  return magic.every((b, i) => head[i] === b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_file' });
  const spot = SPOT_RE.test(String(body.spot || '')) ? String(body.spot) : 'unknown';
  const visitor = visitorFromCookie(req);
  const base = { spot, visitor_id: visitor.id, button: 'screenshot', path_mode: 'n/a' };

  const cfg = await loadConfig();
  if (cfg.mode !== 'demo' && process.env.VERCEL_ENV === 'production') return res.status(403).json({ error: 'server' });

  const ts = await verifyTurnstile(body.turnstile, clientIp(req));
  if (!ts.ok) { await logEvent(req, { ...base, event: 'path_error', reason: ts.reason }); return res.status(403).json({ error: 'server' }); }

  const mediaType = String(body.media_type || '');
  if (!imageOk(body.image, mediaType)) { await logEvent(req, { ...base, event: 'path_error', reason: 'bad_file' }); return res.status(400).json({ error: 'bad_file' }); }

  let ip = '';
  try { ip = await ipHash(req); } catch { ip = ''; }
  let cap;
  try { cap = await checkLlmCaps({ caps: cfg.caps, visitorId: visitor.id, ip }); } catch { cap = { ok: false, reason: 'cap_store_error' }; }
  if (!cap.ok) { await logEvent(req, { ...base, event: 'path_error', reason: cap.reason }); return res.status(429).json({ error: 'cap' }); }

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive', 'X-Robots-Tag': 'noindex' });
  const send = (obj) => { res.write(`data: ${JSON.stringify(obj)}\n\n`); if (typeof res.flush === 'function') res.flush(); };
  const step = (n) => send({ step: n, label: COPY.steps[n - 1], done: true });

  const t0 = Date.now();
  await logEvent(req, { ...base, event: 'path_start' });
  step(1);
  let image = body.image; body.image = null; // one reference, released after the call
  try {
    const ex = await extractTasks({ base64: image, mediaType });
    image = null;
    if (!ex.readable) {
      await logEvent(req, { ...base, event: 'path_error', reason: ex.refused ? 'refusal' : 'cannot_tell', cost_usd: usageCost(ex.usage).toFixed(4) });
      send({ error: 'cannot_tell' }); return res.end();
    }
    step(2);
    const m = await matchTasks(ex.tasks);
    step(3);
    const id = newId();
    const result = {
      id, created: new Date().toISOString(), spot, visitor_id: visitor.id, path: 'screenshot',
      task_count: ex.tasks.length, tasks: ex.tasks, items: m.items, catalog: m.catalog,
      usage: { extract: ex.usage, match: m.usage, cost_usd: Number((usageCost(ex.usage) + usageCost(m.usage)).toFixed(4)) },
    };
    await saveResult(result);
    await logEvent(req, { ...base, event: 'path_complete', result_id: id, tasks: String(ex.tasks.length), automate: String(m.items.filter((i) => i.verdict === 'automate_now').length), cost_usd: String(result.usage.cost_usd), ms: String(Date.now() - t0) });
    step(4);
    send({ result_id: id, url: `/r/${id}` });
    res.end();
  } catch (e) {
    image = null;
    await logEvent(req, { ...base, event: 'path_error', reason: 'exception', detail: String(e && e.message || e).slice(0, 120) });
    send({ error: 'server' }); res.end();
  }
}
