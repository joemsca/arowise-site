// Cloudflare Turnstile verification for the demo's paid actions (spec section 7). Required in
// production: with no TURNSTILE_SECRET_KEY set there, every paid action is refused (fail closed, and
// the visitor is sent to booking). On preview deployments it verifies when a secret exists and is
// skipped otherwise, so the flow can be tested before Joe creates the Cloudflare site.
export const required = () => process.env.VERCEL_ENV === 'production';
export const siteKey = () => process.env.TURNSTILE_SITE_KEY || '';

export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return required() ? { ok: false, reason: 'turnstile_not_configured' } : { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'turnstile_missing' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const body = new URLSearchParams({ secret, response: String(token).slice(0, 4000) });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: ctl.signal });
    const j = await r.json();
    return j.success ? { ok: true } : { ok: false, reason: 'turnstile_failed', codes: j['error-codes'] };
  } catch { return { ok: false, reason: 'turnstile_error' }; } finally { clearTimeout(timer); }
}
