// POST /api/lead: "Email me my results" (spec 4.9, 4.9.1 and the AGENTS.md carve-out). JSON body
// {result_id, first_name, email, business_name, opt_in, turnstile, spot}.
// Order: validate -> Turnstile -> result exists -> exactly-once on result_id -> per-address and
// per-visitor daily caps -> store the lead on the result and on the `flyer:leads` stream (the vault's
// flyer_leads.py files it into Airtable with add_lead.py) -> send the one results email through the
// hash-gated sender -> log -> ping Joe. The email address is validated by syntax and by an MX lookup
// on the domain; no paid verification.
import { promises as dns } from 'node:dns';
import { loadConfig, BOOKING_URL } from '../lib/config.js';
import { logEvent, redis, ping, visitorFromCookie } from '../lib/log.js';
import { getResult, patchResult, RESULT_TTL } from '../lib/results.js';
import { bumpEmailCap } from '../lib/ratelimit.js';
import { sendResultsEmail } from '../lib/email.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { clientIp } from '../lib/ratelimit.js';

const EMAIL_RE = /^[^\s@]{1,64}@([^\s@]+\.[^\s@]{2,})$/;
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

async function mxOk(domain) {
  try { const mx = await dns.resolveMx(domain); if (mx && mx.length) return true; } catch {}
  try { const a = await dns.resolve4(domain); return a && a.length > 0; } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, email_status: 'refused' });

  const resultId = String(body.result_id || '');
  const firstName = clean(body.first_name, 60), businessName = clean(body.business_name, 80);
  const email = clean(body.email, 120).toLowerCase();
  const optIn = body.opt_in === true;
  const m = EMAIL_RE.exec(email);
  if (!firstName || !businessName || !m) return res.status(400).json({ ok: false, email_status: 'refused', reason: 'invalid' });

  const cfg = await loadConfig();
  const visitor = visitorFromCookie(req);
  const result = await getResult(resultId);
  const base = { spot: result ? result.spot : 'unknown', visitor_id: visitor.id, result_id: resultId, button: 'screenshot' };
  if (!result) return res.status(404).json({ ok: false, email_status: 'refused', reason: 'no_result' });

  const ts = await verifyTurnstile(body.turnstile, clientIp(req));
  if (!ts.ok) { await logEvent(req, { ...base, event: 'email_refused', reason: ts.reason }); return res.status(403).json({ ok: false, email_status: 'refused', reason: ts.reason }); }

  if (!(await mxOk(m[1]))) { await logEvent(req, { ...base, event: 'email_refused', reason: 'no_mx' }); return res.status(400).json({ ok: false, email_status: 'refused', reason: 'invalid' }); }

  // Exactly once per result. A second submit sends nothing and says so.
  const first = await redis(['SET', `flyer:emailed:${resultId}`, email, 'NX', 'EX', RESULT_TTL]);
  if (!first) {
    const prior = await redis(['GET', `flyer:emailed:${resultId}`]);
    return res.status(200).json({ ok: true, email_status: 'already', email: prior || '' });
  }
  const capA = await bumpEmailCap(email, 3);
  const capV = await bumpEmailCap(`visitor:${visitor.id}`, 5);
  let emailStatus = 'refused', emailReason = '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'arowise.com';
  const resultsUrl = `https://${host}/r/${resultId}`;
  const bookingUrl = (() => { const u = new URL(cfg.booking_url || BOOKING_URL); u.searchParams.set('utm_source', 'flyer'); u.searchParams.set('utm_medium', 'qr'); u.searchParams.set('utm_campaign', 'flyer-qr'); u.searchParams.set('utm_content', result.spot || 'unknown'); u.searchParams.set('name', firstName); u.searchParams.set('email', email); return u.toString(); })();

  if (!capA.ok || !capV.ok) emailReason = !capA.ok ? 'address_cap' : 'visitor_cap';
  else {
    const r = await sendResultsEmail({ result, firstName, email, businessName, resultsUrl, bookingUrl, cfg });
    emailStatus = r.status; emailReason = r.reason || ''; if (r.detail) emailReason += `:${r.detail}`;
  }

  const lead = { first_name: firstName, email, business_name: businessName, opt_in: optIn, submitted: new Date().toISOString(), email_status: emailStatus, email_reason: emailReason };
  await patchResult(resultId, { lead });
  try {
    await redis(['XADD', 'flyer:leads', '*', 'ts', lead.submitted, 'result_id', resultId, 'spot', result.spot || '', 'visitor_id', visitor.id, 'path', 'screenshot',
      'first_name', firstName, 'email', email, 'business_name', businessName, 'opt_in', optIn ? 'yes' : 'no', 'email_status', emailStatus, 'results_url', resultsUrl]);
  } catch {}
  await logEvent(req, { ...base, event: 'lead_submitted', opt_in: optIn ? 'yes' : 'no' });
  await logEvent(req, { ...base, event: emailStatus === 'sent' ? 'email_sent' : 'email_refused', reason: emailReason });
  const tag = String(result.spot || '').startsWith('test-') ? '[TEST] ' : '';
  await ping(`${tag}New flyer lead: ${businessName} via ${result.spot || 'unknown'}`, `${firstName} <${email}>, screenshot path, email ${emailStatus}${emailReason ? ' (' + emailReason + ')' : ''}\n${resultsUrl}`, { priority: 4, tags: 'tada' });
  return res.status(200).json({ ok: true, email_status: emailStatus, email });
}
