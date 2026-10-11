// The self-requested results email (AGENTS.md carve-out; spec 4.9.1). Exactly one email, once, to the
// address the person typed, from a Joe-approved template whose only variable parts are their name,
// their business name, the results they just saw, the results link and the booking link.
//
// Fail-closed gates, in order: template hash must match the approved hash in the live config;
// every slot must be filled; the results block must have at least one item; no "{slot}" or
// "[bracket]" may remain; RESEND_API_KEY must exist. Any failure returns {status:'refused', reason}
// and nothing is sent. Sends go through Resend's REST API from results@mail.arowise.com
// (subdomain, so arowise.com's own deliverability is never on the line), reply-to joe@arowise.com.
import { createHash } from 'node:crypto';
import * as T from './templates/results-screenshot.js';
import { COPY } from './copy.js';

export const templateHash = (t = T) => createHash('sha256').update(`${t.subject}\n${t.text}\n${t.html}`).digest('hex');
const SLOT_RE = /\{[a-z_]+\}|\[[^\]\n]{1,60}\](?!\()/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The results block is rendered from the structured result only: service name, the quoted task,
// an approved hours range. The model's free-form "why" line stays on the page and out of the email.
export function renderResultsBlock(result, hoursApproved = {}) {
  const picks = (result.items || []).filter((i) => i.verdict === 'automate_now').slice(0, 3);
  const partly = (result.items || []).filter((i) => i.verdict === 'partly').slice(0, 3);
  const human = (result.items || []).filter((i) => i.verdict === 'keep_human').slice(0, 4);
  if (!picks.length && !partly.length) return { text: '', html: '', count: 0 };
  const lines = [], htmls = [];
  const row = (i, n) => {
    const h = hoursApproved[i.service_id];
    const hours = h && Number.isFinite(h.low) && Number.isFinite(h.high) ? ` ${COPY.results.hours(h.low, h.high)}` : '';
    lines.push(`${n}. ${i.service_name}. ${COPY.results.from_list} "${i.task}".${hours}`);
    htmls.push(`<p style="margin:0 0 10px"><strong>${n}. ${esc(i.service_name)}.</strong> ${esc(COPY.results.from_list)} "${esc(i.task)}".${esc(hours)}</p>`);
  };
  let n = 0;
  picks.forEach((i) => row(i, ++n));
  if (partly.length) { lines.push(`\n${COPY.results.partly_h}:`); htmls.push(`<p style="margin:14px 0 6px"><strong>${esc(COPY.results.partly_h)}</strong></p>`); partly.forEach((i) => row(i, ++n)); }
  if (human.length) {
    lines.push(`\n${COPY.results.human_h}: ${human.map((i) => `"${i.task}"`).join(', ')}.`);
    htmls.push(`<p style="margin:14px 0 0"><strong>${esc(COPY.results.human_h)}:</strong> ${human.map((i) => `"${esc(i.task)}"`).join(', ')}.</p>`);
  }
  return { text: lines.join('\n'), html: htmls.join('\n'), count: picks.length + partly.length };
}

function fill(tpl, slots, { html = false } = {}) {
  let out = tpl;
  for (const [k, v] of Object.entries(slots)) {
    const val = k === 'results_block' ? v : (html ? esc(v) : String(v));
    out = out.split(`{${k}}`).join(val);
  }
  return out;
}

export async function sendResultsEmail({ result, firstName, email, businessName, resultsUrl, bookingUrl, cfg }) {
  const approved = cfg && cfg.approved_templates && cfg.approved_templates[T.id];
  const hash = templateHash();
  if (!approved || approved !== hash) return { status: 'refused', reason: 'template_not_approved', hash };
  if (!process.env.RESEND_API_KEY) return { status: 'refused', reason: 'no_sender_key', hash };
  const postal = String(process.env.AROWISE_POSTAL_ADDRESS || '').trim();
  const block = renderResultsBlock(result, (cfg && cfg.hours_approved) || {});
  if (block.count === 0) return { status: 'refused', reason: 'empty_results', hash };
  const slots = { first_name: String(firstName || '').trim(), business_name: String(businessName || '').trim(), results_url: resultsUrl, booking_url: bookingUrl, postal_address: postal };
  for (const [k, v] of Object.entries(slots)) if (!v) return { status: 'refused', reason: `empty_slot:${k}`, hash };
  const text = fill(T.text, { ...slots, results_block: block.text });
  const html = fill(T.html, { ...slots, results_block: block.html }, { html: true });
  if (SLOT_RE.test(text) || SLOT_RE.test(html.replace(/<[^>]+>/g, ''))) return { status: 'refused', reason: 'unfilled_slot', hash };
  const from = process.env.RESULTS_FROM || 'AroWise Automation <results@mail.arowise.com>';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `flyer-${result.id}` },
      body: JSON.stringify({ from, to: [email], reply_to: 'joe@arowise.com', subject: T.subject, text, html, headers: { 'X-Entity-Ref-ID': result.id } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'refused', reason: `resend_${r.status}`, detail: String(j.message || '').slice(0, 200), hash };
    return { status: 'sent', provider_id: j.id || '', hash };
  } catch (e) {
    return { status: 'refused', reason: 'send_error', detail: String(e.message || e).slice(0, 200), hash };
  } finally { clearTimeout(timer); }
}
