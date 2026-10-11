// Shared HTML shell for the demo pages: brand head, tokens from /styles.css, mobile-first page CSS.
// Dark-first ground, chamfers via clip-path, Reef as the only accent, mono kickers. The one
// Controlled Weirdness moment on these pages is the bus (the flyer's node-and-arrow line) used as
// the live progress readout, so nothing else on the page glows or moves.
import { COPY } from '../copy.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PAGE_CSS = `
body.page-demo{min-height:100svh;display:flex;flex-direction:column;background:var(--canvas)}
body.page-demo .wrap{width:min(100%,520px);margin:0 auto;padding:18px var(--pad-x) 40px;flex:1}
body.page-demo .top{display:flex;align-items:center;justify-content:space-between;padding:4px 0 22px}
body.page-demo .top .brand img{width:28px;height:28px}
body.page-demo .top .wordmark{font-size:1.1rem}
body.page-demo .kicker{margin:0 0 10px}
body.page-demo h1{font-size:clamp(1.9rem,8.4vw,2.5rem);line-height:1.12;letter-spacing:-.02em;margin:0 0 14px;font-weight:700}
body.page-demo h1 .accent,body.page-demo h2 .accent{color:var(--teal)}
body.page-demo h2{font-size:1.45rem;line-height:1.2;letter-spacing:-.01em;margin:0 0 10px;font-weight:700}
body.page-demo p{margin:0 0 14px;font-size:1.02rem}
body.page-demo .lede{color:var(--steel);font-size:1.05rem;margin-bottom:24px}
body.page-demo .btn{display:block;width:100%;text-align:center;min-height:58px;padding:16px 18px;font-size:1.05rem;font-weight:700;text-decoration:none}
body.page-demo .btn-ghost{background:transparent;color:var(--text);border:1px solid var(--border-2);clip-path:polygon(var(--ch-btn) 0,100% 0,100% calc(100% - var(--ch-btn)),calc(100% - var(--ch-btn)) 100%,0 100%,0 var(--ch-btn))}
body.page-demo .btn[disabled]{opacity:.45;pointer-events:none}
body.page-demo .choice{display:grid;gap:14px;margin:6px 0 26px}
body.page-demo .choice .card{display:block;background:var(--surface);border:1px solid var(--border);padding:18px 18px 16px;text-align:left;color:var(--text);text-decoration:none;cursor:pointer;clip-path:polygon(var(--ch-card) 0,100% 0,100% calc(100% - var(--ch-card)),calc(100% - var(--ch-card)) 100%,0 100%,0 var(--ch-card));font:inherit;width:100%}
body.page-demo .choice .card:active{border-color:var(--teal)}
body.page-demo .choice .card .t{display:block;font-weight:700;font-size:1.12rem;margin-bottom:6px;color:var(--teal)}
body.page-demo .choice .card .h{display:block;color:var(--steel);font-size:.95rem;line-height:1.45}
body.page-demo .small{color:var(--muted);font-size:.86rem;line-height:1.45}
body.page-demo .small a,body.page-demo .foot a{color:var(--steel)}
body.page-demo .file{display:block;background:var(--surface);border:1px dashed var(--border-2);padding:22px 16px;text-align:center;color:var(--steel);margin:0 0 14px;cursor:pointer;clip-path:polygon(var(--ch-card) 0,100% 0,100% calc(100% - var(--ch-card)),calc(100% - var(--ch-card)) 100%,0 100%,0 var(--ch-card))}
body.page-demo .file input{position:absolute;width:1px;height:1px;opacity:0}
body.page-demo .file img{display:block;max-width:100%;max-height:220px;margin:0 auto 10px;object-fit:contain}
body.page-demo .file.ready{border-style:solid;border-color:var(--teal);color:var(--text)}
body.page-demo .bus{display:block;width:100%;height:auto;margin:26px 0 18px;overflow:visible}
body.page-demo .bus .route{stroke:var(--steel);stroke-opacity:.3;fill:none;stroke-width:1}
body.page-demo .bus .lit{stroke:var(--teal);fill:none;stroke-width:1.5;stroke-dasharray:290;stroke-dashoffset:290;transition:stroke-dashoffset .7s ease}
body.page-demo .bus .node{fill:var(--canvas);stroke:var(--steel);stroke-opacity:.42;stroke-width:1;transition:fill .4s ease,stroke .4s ease}
body.page-demo .bus .node.on{fill:var(--teal);stroke:var(--teal);stroke-opacity:1}
body.page-demo .bus .node.live{filter:drop-shadow(0 0 6px var(--teal))}
body.page-demo .bus .head{fill:var(--steel);fill-opacity:.42;transition:fill .4s ease}
body.page-demo .bus .head.on{fill:var(--teal);fill-opacity:1}
body.page-demo .steps{list-style:none;margin:0;padding:0;display:grid;gap:8px}
body.page-demo .steps li{font-family:var(--mono);font-size:.82rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:flex;gap:12px;align-items:center}
body.page-demo .steps li .i{color:var(--red);width:28px;flex:none}
body.page-demo .steps li.on{color:var(--text)}
body.page-demo .steps li.live{color:var(--teal)}
body.page-demo .hide{display:none!important}
body.page-demo .msg{background:var(--surface);border:1px solid var(--border);padding:18px;margin:0 0 16px;clip-path:polygon(var(--ch-card) 0,100% 0,100% calc(100% - var(--ch-card)),calc(100% - var(--ch-card)) 100%,0 100%,0 var(--ch-card))}
body.page-demo .msg.err{border-color:var(--red)}
body.page-demo .cards{display:grid;gap:14px;margin:0 0 26px}
body.page-demo .card{background:var(--surface);border:1px solid var(--border);padding:18px;clip-path:polygon(var(--ch-card) 0,100% 0,100% calc(100% - var(--ch-card)),calc(100% - var(--ch-card)) 100%,0 100%,0 var(--ch-card))}
body.page-demo .card .n{font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;color:var(--red);margin:0 0 8px}
body.page-demo .card h3{margin:0 0 8px;font-size:1.18rem;line-height:1.25;font-weight:700}
body.page-demo .card .q{color:var(--steel);font-size:.95rem;margin:0 0 8px}
body.page-demo .card .q b{color:var(--text);font-weight:500}
body.page-demo .card .why{margin:0 0 6px;font-size:1rem}
body.page-demo .card .hrs{font-family:var(--mono);font-size:.8rem;letter-spacing:.04em;color:var(--teal);margin:8px 0 0}
body.page-demo .plain li{margin:0 0 6px;color:var(--text)}
body.page-demo .plain{margin:0 0 20px;padding-left:20px}
body.page-demo form label{display:block;font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
body.page-demo form input[type=text],body.page-demo form input[type=email]{width:100%;background:var(--canvas);border:1px solid var(--border-2);color:var(--text);padding:14px 12px;font:inherit;font-size:1.02rem;outline:none}
body.page-demo form input:focus{border-color:var(--teal)}
body.page-demo form .chk{display:flex;gap:10px;align-items:flex-start;margin:16px 0 18px;font-size:.95rem;color:var(--steel)}
body.page-demo form .chk input{margin-top:4px;flex:none;width:18px;height:18px;accent-color:var(--teal)}
body.page-demo section{margin:0 0 34px}
body.page-demo .cal{min-height:640px;margin:14px 0 0}
body.page-demo .foot{padding:18px var(--pad-x) 28px;text-align:center;font-family:var(--mono);font-size:.72rem;letter-spacing:.06em;color:var(--muted)}
body.page-demo .cf-turnstile{margin:0 0 14px}
`;

export function shell({ title, body, extraHead = '', bodyClass = 'page-demo' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(title)} | ${COPY.brand}</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="theme-color" content="#141615" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <style>${PAGE_CSS}</style>
  ${extraHead}
</head>
<body class="${bodyClass}">
  <div class="wrap">
    <div class="top">
      <a class="brand" href="/"><img src="/assets/arowise-icon-200.png" alt="" width="28" height="28" /><span class="wordmark">Aro<span>Wise</span> Automation</span></a>
    </div>
    ${body}
  </div>
  <div class="foot"><a href="/privacy-demo">Privacy note</a> · joe@arowise.com</div>
</body>
</html>`;
}

// The bus: the flyer's node-and-arrow line as a live readout. 4 junctions, one per server step.
export const BUS_X = [80, 150, 220, 290];
export function busSvg() {
  const oct = 'M-2.3 -3.5 L2.3 -3.5 L3.5 -2.3 L3.5 2.3 L2.3 3.5 L-2.3 3.5 L-3.5 2.3 L-3.5 -2.3 Z';
  return `<svg class="bus" viewBox="-2 -4 336 30" aria-hidden="true" shape-rendering="geometricPrecision">
    <path class="route" d="M0 0 L32 18.5 L322 18.5"></path>
    <path class="lit" id="bus-lit" d="M32 18.5 L322 18.5"></path>
    ${BUS_X.map((x, i) => `<path class="node" data-step="${i + 1}" d="${oct}" transform="translate(${x} 18.5) scale(1.6)"></path>`).join('')}
    <path class="head" id="bus-head" d="M322 15 L329 18.5 L322 22 Z"></path>
  </svg>`;
}
