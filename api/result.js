// GET /r/<id>: the results page (spec 4.3, 4.9). Unguessable id, noindex, 90-day TTL; an expired or
// unknown id gets the expired page with a booking button (fail toward booking).
import { loadConfig, BOOKING_URL } from '../lib/config.js';
import { logEvent, visitorFromCookie, visitorCookieHeader } from '../lib/log.js';
import { getResult, ID_RE } from '../lib/results.js';
import { resultPage, expiredPage } from '../lib/pages/result.js';
import { siteKey } from '../lib/turnstile.js';

function bookingUrl(base, spot) { const u = new URL(base); u.searchParams.set('utm_source', 'flyer'); u.searchParams.set('utm_medium', 'qr'); u.searchParams.set('utm_campaign', 'flyer-qr'); u.searchParams.set('utm_content', spot || 'unknown'); return u.toString(); }

export default async function handler(req, res) {
  const id = String(req.query?.id ?? '');
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  let cfg;
  try { cfg = await loadConfig(); } catch { cfg = { booking_url: BOOKING_URL, hours_approved: {} }; }
  try {
    const result = ID_RE.test(id) ? await getResult(id) : null;
    if (!result) { res.writeHead(404, headers); return res.end(expiredPage({ bookingUrl: bookingUrl(cfg.booking_url, 'unknown') })); }
    const visitor = visitorFromCookie(req);
    if (visitor.isNew) headers['Set-Cookie'] = visitorCookieHeader(visitor.id);
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'arowise.com';
    const resultsUrl = `https://${host}/r/${id}`;
    await logEvent(req, { event: 'result_viewed', spot: result.spot, visitor_id: visitor.id, result_id: id, button: 'screenshot', owner: visitor.id === result.visitor_id ? 'yes' : 'no' });
    res.writeHead(200, headers);
    res.end(resultPage({ result, cfg, bookingUrl: bookingUrl(cfg.booking_url, result.spot), resultsUrl, turnstileSiteKey: siteKey() }));
  } catch {
    res.writeHead(302, { Location: bookingUrl(cfg.booking_url, 'unknown'), 'Cache-Control': 'no-store' });
    res.end();
  }
}
