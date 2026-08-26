# arowise.com — 5-page site ("Live Signal" template)

The production source for the arowise.com redesign. The homepage shell and systems here are
the template for the four subpages (`/sales`, `/marketing`, `/operations`, `/finances`).

**Frozen references — never modify:**

- `../c-signal-v2/` — the client-approved single-page design (v2.4). This folder is the
  backup of record. If something here breaks, diff against it.
- `../../copy/` — the copy spec (`index.md`, `sales.md`, `marketing.md`, `operations.md`,
  `finances.md`). Every text slot on a page is transcribed from its `.md` file
  **byte-for-byte** (straight apostrophes stay straight, no rewording, no "improvements").
  Copy changes happen in the `.md` files first, then get re-transcribed here.

## File map

| File | Role |
|---|---|
| `index.html` | Homepage. Sections: Hero → Stat band → What automation actually is → The services you already use (the flow diagram) → Where it pays off (`#areas`) → CRISP → About (`#about`) → Contact (`#contact`). Also carries the monochrome logo sprite (`#lg-*` symbols, sourced from `../../assets/logos/`) used by the flow tiles. |
| `styles.css` | **One stylesheet for all 5 pages.** Organized into 9 commented sections (tokens → base → shell → shared components → circuit → backgrounds → page-specific → responsive → reduced motion). All colors/spacing/type are custom properties in `:root`; add no raw hex to rules. Page-specific blocks are scoped under body classes (`body.page-home`, add `body.page-sales` etc). |
| `site.js` | **One behavior module for all 5 pages** (footer year, mobile menu, stat counter, signal circuit). Fully documented in its header comment. Subpages should not need to touch it. |
| `vercel.json` | `cleanUrls: true` so `/sales` serves `sales.html` (no `.html` in URLs). |
| `assets/` | Brand icon PNGs. Favicons sit at the root. |
| `shots-final-*.png` | Verification screenshots (desktop 1440 / mobile 390), regenerated after visual changes. |

## The circuit system (the page's one moving element)

A 1px titanium bus drops from the header icon, runs the left gutter, jogs outward at each
section junction (octagon node + red `/ 0n` index + lifted teal kicker wording), and
terminates at the page's primary CTA. Every ~8s a teal packet travels it; nodes glint as it
passes and the CTA pulses on arrival. Below ~1170px viewport (left gutter ≤ 44px — iPad
landscape at 1180/1194 logical px stays in the wide/labeled mode) the bus edge-routes at
x=10 with no labels and the inline `/ 0n` spans render inside the kickers instead.
`prefers-reduced-motion` keeps the still circuit, no packet.

**The branch (homepage CRISP rail):** where the CRISP rail's latitude crosses the bus, the
circuit forks — a static 1px extension joins the bus to the rail (with a smaller tap-point
octagon at the fork), and when the main packet's arclength crosses that fork a scaled-down
child pulse spawns, runs the rail at the same speed, glints the five C/R/I/S/P octagons in
sequence, and expires at the arrowhead. The main packet continues down the bus untouched
(same glints, same CTA arrival). Both pulses run in the one rAF loop, dashoffset only.
Runs at every width where the rail is visible (like the flow); in the stacked (<960px)
layout (rail hidden) and under reduced motion no branch runs.

**The flow (homepage workflow diagram):** the `/ 02` section is an n8n-style workflow whose
nodes are chamfered tiles holding monochrome service logos (fixed verb labels: Trigger →
Route → Update/Track ∥ Draft/Notify → Bill → Collect). The circuit forks into it exactly
like the CRISP rail (static extension + tap-point octagon at node 1's latitude), and the
child pulse runs the whole graph: it visibly splits at the fork, runs both branch legs,
recombines at the merge, glints each tile on arrival, and expires past the outlet
arrowhead. Edges are routed orthogonally with 45° chamfer corner cuts from the measured
tile positions, so the CSS grid reflow (horizontal ≥961px, vertical ≤960px) needs no JS
changes. Unlike the branch, the flow pulse runs at **all** widths. Independently, every
~1.5s one tile swaps its logo to a compatible service from its own `data-flow-pool`
(never a mark already visible, never a tile mid-glint) with a hard-stepped relay blip.
Both are disabled under reduced motion. Registration: `data-circuit-flow` +
`data-flow-edges` on the wrapper; see THE FLOW in `site.js`'s header.

Geometry is **measured from the real DOM** on load / fonts-ready / resize, so the circuit
is always physically connected. Full architecture notes are in `site.js`'s header comment.

### How a page registers its sections (do this on new pages — never edit site.js core)

1. Include the shared markup: the `#signal` SVG block just before `</body>` and
   `<script src="/site.js" defer>` in `<head>` (copy from `index.html`).
2. **One junction per section**, in document order:
   - Normal case — a kicker:
     ```html
     <p class="kicker" data-circuit-node><span class="sec-index">/ 01</span>Kicker wording</p>
     ```
     The `.sec-index` span is the single source of truth for the index text and the
     narrow-viewport rendering. On wide viewports the index + wording are drawn on the bus
     and CSS hides the inline copy (it keeps its layout slot via `visibility:hidden` — do
     not change that to `display:none`, the measured latitude depends on it).
     Add `data-circuit-lift="off"` to keep a kicker in flow (index still rides the bus).
   - Non-kicker anchor (e.g. the stat band): supply the label directly:
     ```html
     <p class="stat-line" data-circuit-node data-circuit-label="/ 00">…</p>
     ```
3. **Optionally one branch** — a horizontal rail element with `data-circuit-branch` whose
   `.crisp-node` children mark its junctions (the rail latitude is measured from the first
   marker's center; the run ends at the element's right edge + 3px). The homepage CRISP
   track is the only current user; subpages normally skip this.
4. **Exactly one terminal** — wrap the page's final primary CTA:
   ```html
   <span class="cta-terminal" data-circuit-terminal><a class="btn btn-primary" href="…">Get a free audit</a></span>
   ```
5. Number sequentially per page (`/ 00` or `/ 01` upward). The homepage uses
   `/ 00` stat → `/ 01` explain → `/ 02` flow → `/ 03` areas → `/ 04` CRISP → `/ 05` about
   → `/ 06` contact.

## Adding / editing a page

1. Copy `index.html` to `<page>.html`. Set `<body class="page-<name>">`.
2. Keep the header, mobile menu, footer, `#signal` SVG, analytics scripts, favicon links and
   font link **verbatim**, with three per-page differences:
   - `aria-current="page"` on this page's own nav link (both desktop nav AND mobile menu) —
     this is the active-state marker.
   - The About link is `/#about` on subpages (`#about` only on the homepage).
   - The brand link is `/` on subpages (`#top` only on the homepage).
3. Update `<title>`, `meta description`, `og:title`, `og:description`, and `og:url`
   (`https://arowise.com/<page>`; the homepage keeps `https://arowise.com`).
4. Transcribe the page's copy file slot-by-slot into the template components: kicker slots →
   `.kicker` (+ circuit registration above), H1/Lede → hero, H2/Sub → `.section-title` /
   `.section-sub`, cards → `.cards`/`.card` (tag → `.card-tag`), final CTA → the contact
   band pattern from `index.html`.
5. Page-specific styling goes in `styles.css` section 7 under the page's body class,
   built from the shared tokens and the background recipes in section 6. New shared
   patterns get promoted to section 4, not duplicated.
6. All CTAs point at `https://cal.com/arowise/discovery` with `joe@arowise.com` as the
   quiet note line.

## Local preview

```bash
cd 20-Projects/website/redesign/site && python3 -m http.server 8080
# open http://localhost:8080  (subpage links 404 locally until built — Vercel's
# cleanUrls handles /sales -> sales.html in production)
```

## Deploy

Production deploys from the **`joemsca/arowise-site`** GitHub repo → Vercel → arowise.com.
This folder (in the vault) is the source of truth; copy the contents of `site/` into that
repo and push. Notes:

- `vercel.json` (`cleanUrls: true`) must ship with the files — the nav links (`/sales` etc)
  and the `.html`-less URLs depend on it.
- Vercel Web Analytics must be enabled on the project or `/_vercel/insights/script.js` 404s
  (harmless but noisy). The Leadsy pixel needs no config.
- Verify after deploy: `/ 0n` indices on the bus at ≥1440w, mobile menu at ≤900w, counter
  runs once, every nav link and area panel resolves.

## Shared vs per-page (quick reference)

- **Shared, edit once:** `styles.css` sections 1–6 + 8–9, `site.js`, header/menu/footer
  markup, `#signal` SVG block, contact band + CTA terminal pattern.
- **Per-page:** everything inside `<main>` except the contact band pattern, the meta tags,
  the body class, `aria-current`, and `styles.css` section 7 blocks for that body class.
