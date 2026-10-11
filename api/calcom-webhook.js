// POST /api/calcom-webhook: Cal.com BOOKING_CREATED -> `booking_made` event (spec 4.4, 4.9). The
// signature header (x-cal-signature-256, HMAC-SHA256 of the raw body with CALCOM_WEBHOOK_SECRET) is
// verified before anything is read. A booking is tied to a result by the /r/<id> link the embed
// puts in the booking notes; bookings without one are still logged (spot from utm_content).
// The booking is pushed to the `flyer:bookings` stream for the vault's flyer_leads.py to advance the deal.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { logEvent, redis, ping } from '../lib/log.js';

export const config = { api: { bodyParser: false } };
const RID = /\/r\/([A-Za-z0-9_-]{22})/;

async function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const secret = process.env.CALCOM_WEBHOOK_SECRET || '';
  const raw = await rawBody(req);
  const sig = String(req.headers['x-cal-signature-256'] || '');
  if (!secret || !sig) return res.status(401).json({ error: 'unsigned' });
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).json({ error: 'bad signature' });
  let evt; try { evt = JSON.parse(raw); } catch { return res.status(400).json({ error: 'bad json' }); }
  if (evt.triggerEvent !== 'BOOKING_CREATED') return res.status(200).json({ ok: true, ignored: evt.triggerEvent });
  const p = evt.payload || {};
  const attendee = (p.attendees && p.attendees[0]) || {};
  const notes = String((p.responses && p.responses.notes && (p.responses.notes.value ?? p.responses.notes)) || p.additionalNotes || p.description || '');
  const rid = (RID.exec(notes) || [])[1] || '';
  const utm = (p.tracking || p.metadata || {});
  const fromNotes = (/\(spot ([a-z0-9-]{1,40})\)/.exec(notes) || [])[1] || '';
  const spot = String(utm.utm_content || utm.utmContent || (p.metadata && p.metadata.spot) || fromNotes || '').slice(0, 40) || 'unknown';
  const isTest = spot.startsWith('test-') || /@example\.com$/.test(String(attendee.email || '').toLowerCase());
  const row = { ts: new Date().toISOString(), uid: String(p.uid || ''), start: String(p.startTime || ''), email: String(attendee.email || '').toLowerCase(), name: String(attendee.name || ''), result_id: rid, spot, notes: notes.slice(0, 300) };
  await logEvent(req, { event: 'booking_made', spot, result_id: rid, button: rid ? 'screenshot' : '', booking_uid: row.uid, visitor_id: '' });
  try { await redis(['XADD', 'flyer:bookings', '*', ...Object.entries(row).flat()]); if (rid) await redis(['SET', `flyer:booked:${rid}`, row.uid || '1', 'EX', 7776000]); } catch {}
  if (rid || spot !== 'unknown') await ping(`${isTest ? '[TEST] ' : ''}Flyer booking: ${row.name || row.email}`, `${row.start} via ${spot}${rid ? `\nhttps://arowise.com/r/${rid}` : ''}`, { priority: 4, tags: 'calendar' });
  return res.status(200).json({ ok: true });
}
