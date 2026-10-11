// GET /privacy-demo: the plain-words privacy note for the demo (spec 4.9). noindex unless Joe wants it findable.
import { privacyPage } from '../lib/pages/privacy.js';
export default async function handler(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex, nofollow' });
  res.end(privacyPage());
}
