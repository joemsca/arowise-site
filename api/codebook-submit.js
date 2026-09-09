// Serverless function: receives a client's form answers, files them into the private vault
// repo (they land in the client folder on the next vault sync), and pings Joe's phone.
// Reached as POST /clients/<slug>/submit (vercel.json rewrite). The edge middleware already
// requires a valid portal session for /clients/*; the cookie is verified again here.
//
// Env: CLIENT_PORTAL_SECRET, VAULT_GITHUB_TOKEN (contents:write on joemsca/arowise), NTFY_TOPIC (optional).
import { createHmac } from 'node:crypto';

const VAULT_REPO = 'joemsca/arowise';
const FOLDERS = {
  'advanced-back-and-neck': '10-Clients/advanced-back-and-neck/projects/chart-reader/submissions',
};

function sessionUser(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith('aw_portal='));
  if (!raw) return null;
  const [payload, sig] = raw.slice('aw_portal='.length).split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', process.env.CLIENT_PORTAL_SECRET || '').update(payload).digest('base64url');
  if (expected !== sig) return null;
  const [user, exp] = Buffer.from(payload, 'base64url').toString().split('|');
  return user && Number(exp) > Date.now() ? user : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const slug = String(req.query.client || '');
  const folder = FOLDERS[slug];
  if (!folder) return res.status(400).json({ error: 'unknown client' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad json' }); } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad json' });
  if (JSON.stringify(body).length > 200000) return res.status(413).json({ error: 'too large' });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const form = String(body.form || 'form').replace(/[^a-z0-9-]/gi, '') || 'form';
  const who = (String(body.respondent || user).replace(/[^a-z0-9-]/gi, '').toLowerCase()) || user;
  const path = `${folder}/${form}-${who}-${stamp}.json`;
  const content = Buffer.from(JSON.stringify({ ...body, portal_user: user, received: new Date().toISOString(), client: slug }, null, 1)).toString('base64');

  const gh = await fetch(`https://api.github.com/repos/${VAULT_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${process.env.VAULT_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'arowise-client-portal' },
    body: JSON.stringify({ message: `client portal: ${form} answers from ${who} (${slug})`, content }),
  });
  if (!gh.ok) {
    const text = await gh.text();
    return res.status(502).json({ error: 'could not file the answers', detail: text.slice(0, 300) });
  }
  if (process.env.NTFY_TOPIC) {
    const n = Object.keys(body.answers || {}).length;
    await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
      method: 'POST',
      headers: { Title: `Client portal: ${form} answers from ${who}`, Priority: '3', Tags: 'inbox_tray' },
      body: `${n} answers filed to ${path}`,
    }).catch(() => {});
  }
  return res.status(200).json({ ok: true, filed: path });
}
