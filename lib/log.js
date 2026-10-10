// Event log for the flyer QR funnel: one row per event in the Upstash Redis stream `flyer:events`.
// Read back by ~/AroWise/20-Internal-Projects/flyer-qr-demo/scripts/flyer_events.py (never store
// progress in a layer you cannot read back). Logging must never block or break the visitor's
// redirect: every call here swallows its own errors and is bounded by a timeout.
//
// Env (set by the Upstash marketplace integration): KV_REST_API_URL + KV_REST_API_TOKEN, or
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN. Optional NTFY_TOPIC for the per-scan ping.
// No raw IP addresses are ever stored (spec 4.4). Geo comes from Vercel's approximate headers.
import { randomBytes } from 'node:crypto';

export const STREAM = 'flyer:events';
const COOKIE = 'aw_v';
const VISITOR_RE = /^[A-Za-z0-9_-]{22}$/;

export function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export async function redis(command, { timeoutMs = 1500 } = {}) {
  const env = redisEnv();
  if (!env) throw new Error('redis env missing');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(env.url, { method: 'POST', headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: ctl.signal });
    const json = await r.json();
    if (!r.ok || json.error) throw new Error(json.error || `redis http ${r.status}`);
    return json.result;
  } finally { clearTimeout(timer); }
}

// First-party visitor id: 128 random bits, base64url (22 chars). Set once, kept a year.
export function visitorFromCookie(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  const v = raw ? raw.slice(COOKIE.length + 1) : '';
  if (VISITOR_RE.test(v)) return { id: v, isNew: false };
  return { id: randomBytes(16).toString('base64url'), isNew: true };
}
export function visitorCookieHeader(id) {
  return `${COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

// Device fields for analytics only (never a gate). `other` is the named cannot-tell outcome.
export function deviceInfo(req) {
  const ua = String(req.headers['user-agent'] || '');
  let device = 'other', os_version = '';
  let m;
  if ((m = ua.match(/(?:iPhone|iPad|iPod).*?OS (\d+(?:_\d+)*)/))) { device = 'ios'; os_version = m[1].replace(/_/g, '.'); }
  else if (/iPhone|iPad|iPod/.test(ua)) { device = 'ios'; }
  else if ((m = ua.match(/Android (\d+(?:\.\d+)*)/))) { device = 'android'; os_version = m[1]; }
  else if (/Android/.test(ua)) { device = 'android'; }
  const browser =
    /Instagram/.test(ua) ? 'instagram' :
    /FBAN|FBAV|FB_IAB/.test(ua) ? 'facebook' :
    /LinkedInApp/.test(ua) ? 'linkedin' :
    /Snapchat/.test(ua) ? 'snapchat' :
    /TikTok|musical_ly/i.test(ua) ? 'tiktok' :
    /EdgiOS|EdgA|Edg\//.test(ua) ? 'edge' :
    /CriOS|Chrome\//.test(ua) ? 'chrome' :
    /FxiOS|Firefox\//.test(ua) ? 'firefox' :
    /Safari\//.test(ua) ? 'safari' : 'other';
  const lang = String(req.headers['accept-language'] || '').split(',')[0].trim().slice(0, 12);
  const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); } };
  return { device, os_version, browser, lang, geo_city: dec(req.headers['x-vercel-ip-city']), geo_region: dec(req.headers['x-vercel-ip-country-region']) };
}

const COLUMNS = ['ts', 'event', 'spot', 'visitor_id', 'button', 'path_mode', 'result_id', 'device', 'os_version', 'browser', 'lang', 'geo_city', 'geo_region'];

// Append one event. Never throws. Returns the stream id or null.
export async function logEvent(req, fields, { timeoutMs = 1500 } = {}) {
  try {
    const row = { ts: new Date().toISOString(), ...deviceInfo(req), ...fields };
    const flat = [];
    for (const k of [...COLUMNS, ...Object.keys(row).filter((k) => !COLUMNS.includes(k))]) {
      flat.push(k, row[k] == null ? '' : String(row[k]).slice(0, 500));
    }
    return await redis(['XADD', STREAM, '*', ...flat], { timeoutMs });
  } catch { return null; }
}

// Phone ping via ntfy. Never throws.
export async function ping(title, body, { priority = 3, tags = 'bell', timeoutMs = 1500 } = {}) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    await fetch(`https://ntfy.sh/${topic}`, { method: 'POST', headers: { Title: title, Priority: String(priority), Tags: tags }, body, signal: ctl.signal });
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}
