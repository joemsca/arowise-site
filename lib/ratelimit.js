// Caps and rate limits for the demo's paid actions (spec 4.4, 4.5, section 7). All counters live in
// Upstash Redis with a 48h expiry. No raw IP is ever stored: the per-IP key is sha256(ip + daily salt)
// and the salt lives only in Redis for two days.
import { createHash, randomBytes } from 'node:crypto';
import { redis } from './log.js';

export const day = (d = new Date()) => d.toISOString().slice(0, 10);

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers['x-real-ip'] || '') || '';
}

export async function ipHash(req) {
  const ip = clientIp(req);
  if (!ip) return '';
  const key = `flyer:salt:${day()}`;
  let salt = await redis(['GET', key]);
  if (!salt) {
    salt = randomBytes(16).toString('base64url');
    const set = await redis(['SET', key, salt, 'NX', 'EX', 172800]);
    if (!set) salt = await redis(['GET', key]);
  }
  return createHash('sha256').update(ip + salt).digest('base64url').slice(0, 22);
}

async function bump(key) {
  const n = await redis(['INCR', key]);
  if (n === 1) await redis(['EXPIRE', key, 172800]);
  return n;
}

// Counts the attempt and answers whether it may run. Over-cap attempts still count (an attacker
// cannot probe for free), which is why the caps are per day and not per minute.
export async function checkLlmCaps({ caps, visitorId, ip }) {
  const d = day();
  const limits = {
    global: Number.isFinite(caps.llm_runs_per_day) ? caps.llm_runs_per_day : 200,
    visitor: Number.isFinite(caps.llm_runs_per_visitor_per_day) ? caps.llm_runs_per_visitor_per_day : 3,
    ip: Number.isFinite(caps.llm_runs_per_ip_per_day) ? caps.llm_runs_per_ip_per_day : 10,
  };
  const g = await bump(`flyer:cap:llm:${d}`);
  if (g > limits.global) return { ok: false, reason: 'global_cap', count: g };
  if (visitorId) { const v = await bump(`flyer:cap:v:${visitorId}:${d}`); if (v > limits.visitor) return { ok: false, reason: 'visitor_cap', count: v }; }
  if (ip) { const i = await bump(`flyer:cap:ip:${ip}:${d}`); if (i > limits.ip) return { ok: false, reason: 'ip_cap', count: i }; }
  return { ok: true };
}

export async function bumpEmailCap(email, limit = 3) {
  const h = createHash('sha256').update(email.toLowerCase()).digest('base64url').slice(0, 22);
  const n = await bump(`flyer:emailcap:${h}:${day()}`);
  return { ok: n <= limit, count: n };
}
