// GET /demo?s=<spot>: the demo screen, served only while the live mode is `demo` (spec 4.3). In
// production with any other mode the visitor is sent to booking, so an unapproved demo can never be
// reached by URL. Preview deployments always render it, for testing.
import { loadConfig, BOOKING_URL } from '../lib/config.js';
import { logEvent, visitorFromCookie, visitorCookieHeader } from '../lib/log.js';
import { demoPage } from '../lib/pages/demo.js';
import { siteKey } from '../lib/turnstile.js';

const SPOT_RE = /^[a-z0-9-]{1,40}$/;
function bookingUrl(base, spot) { const u = new URL(base); u.searchParams.set('utm_source', 'flyer'); u.searchParams.set('utm_medium', 'qr'); u.searchParams.set('utm_campaign', 'flyer-qr'); u.searchParams.set('utm_content', spot); return u.toString(); }

export default async function handler(req, res) {
  const raw = String(req.query?.s ?? '');
  const spot = SPOT_RE.test(raw) ? raw : 'unknown';
  try {
    const cfg = await loadConfig();
    const booking = bookingUrl(cfg.booking_url, spot);
    const live = cfg.mode === 'demo' || process.env.VERCEL_ENV !== 'production';
    if (!live) { res.writeHead(302, { Location: booking, 'Cache-Control': 'no-store' }); return res.end(); }
    const visitor = visitorFromCookie(req);
    const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    if (visitor.isNew) headers['Set-Cookie'] = visitorCookieHeader(visitor.id);
    await logEvent(req, { event: 'demo_view', spot, visitor_id: visitor.id, mode: cfg.mode });
    res.writeHead(200, headers);
    res.end(demoPage({ cfg, spot, bookingUrl: booking, turnstileSiteKey: siteKey() }));
  } catch {
    res.writeHead(302, { Location: bookingUrl(BOOKING_URL, spot), 'Cache-Control': 'no-store' });
    res.end();
  }
}
