import { COPY } from '../copy.js';
import { shell, esc } from './shell.js';
export function privacyPage() {
  const p = COPY.privacy;
  const body = `<section><h1>${esc(p.title)}</h1><p class="lede">${esc(p.intro)}</p>${p.blocks.map(([h, t]) => `<p><b>${esc(h)}</b> ${esc(t)}</p>`).join('')}<p>${esc(p.contact)}</p></section>`;
  return shell({ title: p.title, body });
}
