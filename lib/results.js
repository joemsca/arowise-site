// Results storage: one JSON document per demo run, keyed by an unguessable id, 90-day TTL (spec 4.3,
// 4.5). Never contains an image. The lead block is added by api/lead.js when the person asks for
// their results by email.
import { randomBytes } from 'node:crypto';
import { redis } from './log.js';

export const RESULT_TTL = 90 * 24 * 3600;
export const ID_RE = /^[A-Za-z0-9_-]{22}$/;
export const newId = () => randomBytes(16).toString('base64url');

export async function saveResult(result) {
  await redis(['SET', `flyer:result:${result.id}`, JSON.stringify(result), 'EX', RESULT_TTL]);
  return result.id;
}

export async function getResult(id) {
  if (!ID_RE.test(id)) return null;
  const raw = await redis(['GET', `flyer:result:${id}`]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Re-read, patch, write back, keeping the remaining TTL.
export async function patchResult(id, patch) {
  const cur = await getResult(id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  const ttl = await redis(['TTL', `flyer:result:${id}`]);
  await redis(['SET', `flyer:result:${id}`, JSON.stringify(next), 'EX', ttl > 0 ? ttl : RESULT_TTL]);
  return next;
}
