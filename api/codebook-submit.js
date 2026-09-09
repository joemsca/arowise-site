// Serverless function: receives a client's codebook answers, files them into the private
// vault repo (so they land in the client folder on the next vault sync), and pings Joe's phone.
// Reached as POST /clients/<slug>/submit (vercel.json rewrite) so the browser's Basic-Auth
// credentials for /clients/ are sent along; the middleware gates it, and we re-check here.
//
// Env: CLIENT_PORTAL_USER, CLIENT_PORTAL_PASS, VAULT_GITHUB_TOKEN (contents:write on joemsca/arowise),
//      NTFY_TOPIC (optional).
const VAULT_REPO = 'joemsca/arowise';
const FOLDERS = {
  'advanced-back-and-neck': '10-Clients/advanced-back-and-neck/projects/chart-reader/submissions',
};

function authorized(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, p] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  return u === process.env.CLIENT_PORTAL_USER && p === process.env.CLIENT_PORTAL_PASS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const slug = String(req.query.client || '');
  const folder = FOLDERS[slug];
  if (!folder) return res.status(400).json({ error: 'unknown client' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad json' }); } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad json' });
  const raw = JSON.stringify(body);
  if (raw.length > 200000) return res.status(413).json({ error: 'too large' });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const form = String(body.form || 'codebook').replace(/[^a-z0-9-]/gi, '');
  const who = String(body.respondent || 'unknown').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'unknown';
  const path = `${folder}/${form}-${who}-${stamp}.json`;
  const content = Buffer.from(JSON.stringify({ ...body, received: new Date().toISOString(), client: slug }, null, 1)).toString('base64');

  const gh = await fetch(`https://api.github.com/repos/${VAULT_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.VAULT_GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'arowise-client-portal',
    },
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
