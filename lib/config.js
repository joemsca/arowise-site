// Live config for the flyer QR router (/go) and the demo app (/demo).
//
// Source of truth: the Vercel Global Config store "arowise-flyer-go", read over plain HTTPS with
// the connection string in env GLOBAL_CONFIG (https://global-config.vercel.com/<id>?token=<t>).
// Joe flips `mode` (book | demo) from the Vercel dashboard on his phone; it propagates in <10s,
// no deploy. Fallback: lib/go-default.js in this repo. Last resort: booking only.
// Every failure path lands the visitor on the booking page (spec section 2, "fail toward booking").
import DEFAULT from './go-default.js';

export const BOOKING_URL = 'https://cal.com/arowise/discovery';
const MODES = new Set(['book', 'demo']);
const SLUG = /^[a-z][a-z0-9_]{0,40}$/;

function parseConnection(str) {
  try {
    const u = new URL(str);
    const id = u.pathname.replace(/^\/+|\/+$/g, '');
    const token = u.searchParams.get('token');
    return id && token ? { origin: u.origin, id, token } : null;
  } catch { return null; }
}

// Vercel renamed Edge Config to Global Config in 2026; a store with a legacy `ecfg_` id answers on
// edge-config.vercel.com and 401s on global-config.vercel.com (verified 2026-10-09). Try the host in
// the connection string first, then the other one, so a Vercel-side migration cannot blank the config.
const HOSTS = ['https://edge-config.vercel.com', 'https://global-config.vercel.com'];

async function fetchOnce(url, token, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal });
    if (!r.ok) return null;
    const json = await r.json();
    return json && typeof json === 'object' && !Array.isArray(json) ? json : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function fetchStore(timeoutMs) {
  const conn = parseConnection(process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG || '');
  if (!conn) return null;
  for (const origin of [conn.origin, ...HOSTS.filter((h) => h !== conn.origin)]) {
    const json = await fetchOnce(`${origin}/${conn.id}/items`, conn.token, timeoutMs);
    if (json) return json;
  }
  return null;
}

function allowedBookingUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && (x.hostname === 'cal.com' || x.hostname.endsWith('.cal.com') || x.hostname === 'arowise.com');
  } catch { return false; }
}

// Property tests on every field; anything that fails lands on the booking default for that field.
// `_source` records which layer answered so the event log can show it (never trust "green").
function sanitize(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = MODES.has(raw.mode) ? raw.mode : 'book';
  const booking_url = allowedBookingUrl(raw.booking_url) ? raw.booking_url : BOOKING_URL;
  const buttons = (Array.isArray(raw.buttons) ? raw.buttons : [])
    .filter((b) => b && typeof b.id === 'string' && SLUG.test(b.id))
    .map((b) => ({ id: b.id, enabled: b.enabled === true, order: Number.isFinite(b.order) ? b.order : 99 }))
    .sort((a, b) => a.order - b.order);
  const caps = Object.fromEntries(Object.entries(raw.caps && typeof raw.caps === 'object' ? raw.caps : {})
    .filter(([k, v]) => SLUG.test(k) && Number.isFinite(v) && v >= 0));
  const ping_on_scan = raw.ping_on_scan !== false;
  return { mode, booking_url, buttons, caps, ping_on_scan, _source: source, _mode_raw: typeof raw.mode === 'string' ? raw.mode : '' };
}

export async function loadConfig({ timeoutMs = 1500 } = {}) {
  const live = sanitize(await fetchStore(timeoutMs), 'global-config');
  if (live) return live;
  const file = sanitize(DEFAULT, 'repo-default');
  if (file) return file;
  return { mode: 'book', booking_url: BOOKING_URL, buttons: [], caps: {}, ping_on_scan: true, _source: 'hardcoded', _mode_raw: '' };
}
