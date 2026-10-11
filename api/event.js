// POST /api/event: client-side funnel events (spec 4.4). Only the events a browser legitimately
// originates are accepted; everything else is a 400. Never blocks the page (fire-and-forget).
import { logEvent, visitorFromCookie } from '../lib/log.js';

const CLIENT_EVENTS = new Set(['demo_view', 'button_tap', 'path_start', 'save_tap', 'book_tap']);
const SPOT_RE = /^[a-z0-9-]{1,40}$/;
const SLUG = /^[a-z_]{1,24}$/;
const ID_RE = /^[A-Za-z0-9_-]{22}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || !CLIENT_EVENTS.has(body.event)) return res.status(400).end();
  const visitor = visitorFromCookie(req);
  await logEvent(req, {
    event: body.event, spot: SPOT_RE.test(String(body.spot || '')) ? body.spot : 'unknown', visitor_id: visitor.id,
    button: SLUG.test(String(body.button || '')) ? body.button : '', result_id: ID_RE.test(String(body.result_id || '')) ? body.result_id : '', origin: 'client',
  });
  res.status(204).end();
}
