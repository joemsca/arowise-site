// Serverless function: the flyer QR router. Reached as GET /go/<spot> (vercel.json rewrite);
// /go with no spot is spot "unknown". Logs a `scan` event, sets the first-party visitor cookie,
// and 302s (never 301/308: phones cache permanent redirects) to either the booking page with the
// spot in utm_content, or /demo?s=<spot>, depending on the live config.
//
// THE /go ROUTE IS PERMANENT. It is printed on physical flyers. Never remove or rename it.
// Spec: ~/AroWise/20-Internal-Projects/flyer-qr-demo/README.md section 4.1.
// Env: GLOBAL_CONFIG (live config), KV_REST_API_URL/TOKEN (event log), NTFY_TOPIC (optional ping).
import { loadConfig, BOOKING_URL } from '../lib/config.js';
import { logEvent, ping, visitorFromCookie, visitorCookieHeader } from '../lib/log.js';

const SPOT_RE = /^[a-z0-9-]{1,40}$/;

function bookingUrl(base, spot) {
  const u = new URL(base);
  u.searchParams.set('utm_source', 'flyer');
  u.searchParams.set('utm_medium', 'qr');
  u.searchParams.set('utm_campaign', 'flyer-qr');
  u.searchParams.set('utm_content', spot);
  return u.toString();
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow', ...extraHeaders });
  res.end();
}

export default async function handler(req, res) {
  const raw = String(req.query?.spot ?? '');
  const spot = SPOT_RE.test(raw) ? raw : 'unknown';
  try {
    const cfg = await loadConfig();
    const visitor = visitorFromCookie(req);
    const headers = visitor.isNew ? { 'Set-Cookie': visitorCookieHeader(visitor.id) } : {};
    const dest = cfg.mode === 'demo' ? `/demo?s=${encodeURIComponent(spot)}` : bookingUrl(cfg.booking_url, spot);

    // Log first, bounded by its own timeout, so a slow log costs at most ~1.5s and never the redirect.
    const id = await logEvent(req, { event: 'scan', spot, visitor_id: visitor.id, mode: cfg.mode, config_source: cfg._source, config_mode_raw: cfg._mode_raw, raw_spot: raw === spot ? '' : raw.slice(0, 40) });
    if (cfg.ping_on_scan) {
      const d = (req.headers['x-vercel-ip-city'] ? decodeURIComponent(String(req.headers['x-vercel-ip-city'])) : 'unknown city');
      // Anything that reaches Joe's phone from a test spot carries [TEST] (AGENTS.md test-data rule).
      const tag = spot.startsWith('test-') || spot === 'unknown' ? '[TEST] ' : '';
      await ping(`${tag}Flyer scan: ${spot}`, `${cfg.mode} mode, ${d}${id ? '' : ' (log write failed)'}`, { priority: 3, tags: 'eyes' });
    }
    redirect(res, dest, headers);
  } catch {
    // Anything unexpected: the visitor still lands on the booking page.
    redirect(res, bookingUrl(BOOKING_URL, spot));
  }
}
