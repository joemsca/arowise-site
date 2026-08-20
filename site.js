/* ============================================================
   AroWise Automation — site.js
   ONE shared behavior module for every page of arowise.com.
   Loaded with <script src="site.js" defer> so the DOM is parsed
   before it runs. No dependencies, no build step.

   CONTENTS
     1. Footer year
     2. Mobile nav menu (hamburger <= 900px)
     3. Stat counter (red 20 -> teal 3, runs once when visible)
     4. The signal circuit (the page's only motion)

   ------------------------------------------------------------
   CIRCUIT ARCHITECTURE (part 4)
   ------------------------------------------------------------
   One SVG (#signal, appended in each page's HTML just before this
   script) is sized to the full document. A single polyline runs:

     header icon -> down 30px -> 60deg diagonal into the left
     gutter -> down the gutter, jogging outward at each registered
     section junction -> 60deg approach into the primary CTA.

   The polyline is drawn three times: #sig-base (static 1px
   titanium), #sig-tail (teal comet tail) and #sig-head (bright
   head), the latter two animated with stroke-dashoffset — cheap,
   no layout work per frame. Junction octagons (#sig-nodes),
   red "/ 0n" indices (#sig-idx) and lifted teal kicker wording
   (#sig-kick) are separate SVG children.

   GEOMETRY IS MEASURED FROM THE REAL DOM (getBoundingClientRect
   on the registered anchors) so the circuit stays physically
   connected at every width. build() reruns on load, on fonts
   ready, and (debounced) on resize.

   WIDE vs NARROW: when the centered .container leaves a real left
   gutter (> 70px), the bus runs at ~55% of the gutter, indices +
   kicker wording render ON the bus as SVG text, and the inline
   HTML copies hide (body gets .idx-on-bus; the kicker keeps its
   layout slot via visibility:hidden so the measured junction
   latitude — and the vertical rhythm — both hold). Below that
   (~1220px viewport) the bus edge-routes at x=10 with no labels
   and the inline "/ 0n" spans + kickers render normally in flow.

   Every ~8s one teal packet travels the path; each junction and
   its index glint as the head passes; the CTA terminal pulses on
   arrival. prefers-reduced-motion: the packet never launches and
   CSS dims the base line (the still circuit remains).

   THE BRANCH (optional, one per page — the home CRISP rail):
   an element carrying data-circuit-branch that contains
   .crisp-node octagon markers declares a horizontal branch line.
   build() measures it: the rail latitude is the vertical center
   of the first marker (markers sit ON the rail line), the run
   goes from the bus (x = gutter) through every marker to the
   element's right edge + 3px (the arrowhead tip). Three extra
   strokes render it: #sig-branch-base draws ONLY the bus->rail
   extension segment (the rail itself is CSS — drawing over it
   would double the ink), while #sig-branch-tail/-head span the
   full run for the child pulse. A smaller octagon (scale .72) is
   planted at the fork as a tap point. When the MAIN packet's
   arclength crosses the fork, a scaled-down child pulse spawns
   and runs the branch at the same px/ms speed — both animate in
   the ONE existing rAF loop, dashoffset only. The child glints
   each .crisp-node in sequence (same .glint contract as bus
   nodes) and expires at the arrowhead. The main packet's timing,
   glints and CTA arrival are completely untouched. Wide mode
   only (same precedent as the "/ 0n" labels); in narrow/stacked
   layouts and under reduced motion no branch pulse ever runs.

   THE FLOW (optional, one per page — the home workflow diagram):
   an element carrying data-circuit-flow whose .flow-node children
   hold chamfered logo tiles declares a workflow GRAPH (edges in
   data-flow-edges, "a>b" pairs, sources listed before targets).
   build() measures the real tiles, infers the orientation from
   nodes 1->2 (horizontal on desktop, vertical in the stacked
   layout — the CSS reflow is invisible to this code), and routes
   each edge orthogonally with 45deg chamfer corner cuts: the
   machined sibling of n8n's beziers. Per edge, three strokes in
   #sig-flow-base/-tail/-head (grouped; one path each per edge).
   Where two edges share a port run (the fork out of node 2, the
   merge into node 7) the BASE ink is trimmed to the unshared
   points so the 30%-alpha line never doubles; the pulse paths
   stay full-length, so one head visibly splits into two at the
   fork and recombines at the merge (equal branch lengths by
   construction — the grid is symmetric). A static extension
   joins the bus to node 1's tile at its latitude (tap-point
   octagon at the fork, same as the branch), and when the MAIN
   packet crosses it a child pulse spawns and runs the whole
   graph at a calmer FLOWK (0.55x) of the main packet's px/ms —
   the main packet and the CRISP branch keep their own speed —
   glinting each tile on arrival and expiring past the outlet
   arrowhead (the rAF loop stays alive until the flow finishes,
   even after the main packet has arrived). Unlike the branch this
   runs at ALL widths (the diagram is visible on mobile, so the
   pulse is too); under reduced motion it never runs. The logo
   swap on the tiles (part 5) is independent of the circuit.

   ------------------------------------------------------------
   HOW A PAGE REGISTERS ITS SECTIONS (the declarative interface)
   ------------------------------------------------------------
   The circuit discovers everything from data attributes — to add
   or reorder sections you edit HTML only, never this file.

   1. JUNCTIONS — put data-circuit-node on ONE element per
      section, in document order. Two shapes:

      a) A kicker (the normal case). Markup:
           <p class="kicker" data-circuit-node>
             <span class="sec-index">/ 01</span>Kicker wording</p>
         The "/ 0n" index text comes from the .sec-index span
         (single source of truth + the narrow-viewport rendering).
         On wide viewports the index AND the kicker wording are
         lifted onto the bus; CSS hides the inline copy.
         Opt out of the lift (keep the kicker in flow, index still
         drawn on the bus) with data-circuit-lift="off".

      b) Any other element (e.g. the home stat band's .stat-line):
         supply the index text directly:
           <p class="stat-line" data-circuit-node
              data-circuit-label="/ 00">...</p>
         No kicker lift happens for these.

      The junction's latitude = the element's vertical midpoint.

   2. BRANCH (optional) — put data-circuit-branch on a horizontal
      rail element whose .crisp-node children mark its junctions
      (see THE BRANCH above). The home CRISP track is the only
      current user. At most one per page.

   2b. FLOW (optional) — put data-circuit-flow + data-flow-edges
      ("a>b" pairs, space-separated, sources before targets) on a
      wrapper whose .flow-node children (data-flow-id, .flow-tile)
      are placed by CSS grid (see THE FLOW above). Requires the
      #sig-flow-* groups in the page's #signal block. The home
      workflow diagram is the only current user. At most one per
      page.

   3. TERMINAL — wrap the page's final primary CTA button:
           <span class="cta-terminal" data-circuit-terminal>
             <a class="btn btn-primary" href="...">...</a></span>
      The path terminates at the button's left edge and the
      wrapper gets .arrived pulses. Exactly one per page.

   4. GUTTER REFERENCE — the first .container inside <main>
      (normally the hero's) defines the left gutter. Every page
      already has one; nothing to do.

   That's it. Numbering restarts per page; keep indices sequential
   ("/ 00" or "/ 01" upward) so the wayfinding reads honestly.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ 1. footer year ============ */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============ 2. mobile nav menu ============ */
  /* Real disclosure semantics: button[aria-expanded] controls the panel's
     [hidden] attribute. Closes on link tap, on Escape (focus returns to
     the button), and when the viewport grows past the nav breakpoint. */
  var navToggle = document.querySelector('.nav-toggle');
  var menuPanel = document.getElementById('mobile-menu');
  if (navToggle && menuPanel) {
    var setMenu = function (open) {
      menuPanel.hidden = !open;
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    navToggle.addEventListener('click', function () {
      setMenu(menuPanel.hidden);
    });
    menuPanel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menuPanel.hidden) {
        setMenu(false);
        navToggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (document.documentElement.clientWidth > 900 && !menuPanel.hidden) setMenu(false);
    });
  }

  /* ============ 3. stat counter (20 -> 3) ============ */
  /* Digits start hot (manual = red), cool through ember, land teal
     (automated). Runs exactly once, when the band is ~70% visible.
     setTimeout-driven, not rAF, so headless virtual time can verify it.
     Colors mirror the CSS tokens: Ignition (hot) / Brick (ember) / Reef (cool). */
  var num = document.querySelector('.stat-num');
  if (num) {
    var HOT = [242, 74, 28];    /* Ignition #F24A1C */
    var EMBER = [179, 81, 60];  /* Brick #B3513C */
    var COOL = [0, 198, 203];   /* Reef #00C6CB */
    var mix = function (a, b, t) {
      return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
                      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
                      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
    };
    var colorAt = function (p) {
      return p < 0.45 ? mix(HOT, EMBER, p / 0.45) : mix(EMBER, COOL, (p - 0.45) / 0.55);
    };
    var runCount = function (node) {
      var from = +node.dataset.from, to = +node.dataset.to, dur = 4600, start = Date.now();
      node.style.color = colorAt(0);
      node.textContent = from;
      function step() {
        var p = Math.min((Date.now() - start) / dur, 1);
        /* ease-in-out cubic: holds on 20 briefly, paces the middle, settles on 3 */
        var eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        node.textContent = Math.round(from + (to - from) * eased);
        node.style.color = colorAt(eased);
        if (p < 1) setTimeout(step, 16);
      }
      setTimeout(step, 16);
    };
    if (reduce || !('IntersectionObserver' in window)) {
      num.textContent = num.dataset.to;
      num.style.color = mix(COOL, COOL, 0);
    } else {
      var sobs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            runCount(num);
            sobs.unobserve(en.target);
          }
        });
      }, { threshold: 0.7 });
      sobs.observe(num.closest('.statband') || num);
    }
  }

  /* ============ 4. the signal circuit ============ */
  var svg = document.getElementById('signal');
  if (!svg) return;                            /* page opted out of the circuit */
  var base = document.getElementById('sig-base');
  var tail = document.getElementById('sig-tail');
  var head = document.getElementById('sig-head');
  var nodesG = document.getElementById('sig-nodes');
  var idxG = document.getElementById('sig-idx');
  var kickG = document.getElementById('sig-kick');
  var bBase = document.getElementById('sig-branch-base');
  var bTail = document.getElementById('sig-branch-tail');
  var bHead = document.getElementById('sig-branch-head');
  var terminal = document.querySelector('[data-circuit-terminal]');
  /* a page that declares a branch but whose #signal block predates the
     branch subsystem gets the three strokes synthesized in the right
     z-order (base under the pulses, pulses under the node/label groups) */
  if (!bBase && document.querySelector('[data-circuit-branch]')) {
    bBase = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bBase.setAttribute('id', 'sig-branch-base');
    svg.insertBefore(bBase, document.getElementById('sig-tail'));
    bTail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bTail.setAttribute('id', 'sig-branch-tail');
    bHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bHead.setAttribute('id', 'sig-branch-head');
    svg.insertBefore(bTail, nodesG);
    svg.insertBefore(bHead, nodesG);
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  var TAN60 = Math.tan(Math.PI / 3);           /* 60deg-from-vertical jogs: dx = dy * tan60 */
  var HEAD = 24, TAILLEN = 80;                 /* packet head + comet tail lengths (px) */
  var BHEAD = 16, BTAIL = 52;                  /* branch child pulse: same language, scaled down */
  var FHEAD = 14, FTAIL = 44;                  /* flow child pulse: smallest of the family */
  var FLOWK = 0.55;                            /* flow pulse speed vs the main packet: slower, so the
                                                  split/merge reads and short mobile edges stay smooth
                                                  (the main packet and branch keep their own speed) */
  var OCT = 'M-2.3 -3.5 L2.3 -3.5 L3.5 -2.3 L3.5 2.3 L2.3 3.5 L-2.3 3.5 L-3.5 2.3 L-3.5 -2.3 Z';
  var totalLen = 0, nodeMeta = [];
  var branch = null;                           /* {s0, len, fork, nodes:[{el,s}]} or null */
  var fBaseG = document.getElementById('sig-flow-base');
  var fTailG = document.getElementById('sig-flow-tail');
  var fHeadG = document.getElementById('sig-flow-head');
  var flow = null;                             /* {s0, total, fork, edges:[{pp,base,s0,len,tail,head}], nodes:[{el,s}]} or null */

  /* a kicker's wording, minus its index span (text nodes only), uppercased
     the way the CSS renders it in flow */
  function kickerText(k) {
    var s = '', c = k.childNodes;
    for (var j = 0; j < c.length; j++) if (c[j].nodeType === 3) s += c[j].textContent;
    return s.replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function setPacket(h) {
    /* dash covering [h - len, h) along the path; off-path at h=0 and h=L+len.
       Each stroke clamps h to its OWN exit window (L + its dash length):
       TAILLEN > 3*HEAD, so an unclamped head goes dashoffset-negative for
       the last few px of the traversal and the dash pattern wraps — a
       phantom head flashes at the TOP of the bus (under the header icon)
       on whichever cycles a frame lands in that window. */
    head.setAttribute('stroke-dashoffset', totalLen + 3 * HEAD - Math.min(h, totalLen + HEAD));
    tail.setAttribute('stroke-dashoffset', totalLen + 3 * TAILLEN - Math.min(h, totalLen + TAILLEN));
  }

  /* same trick for the branch child pulse; no-op when no branch is built.
     Same per-stroke clamp: BTAIL > 3*BHEAD, same wrap otherwise. */
  function setBranchPacket(h) {
    if (!branch) return;
    bHead.setAttribute('stroke-dashoffset', branch.len + 3 * BHEAD - Math.min(h, branch.len + BHEAD));
    bTail.setAttribute('stroke-dashoffset', branch.len + 3 * BTAIL - Math.min(h, branch.len + BTAIL));
  }

  /* per-edge dash windows for the flow pulse: each edge shows the part of
     the traversal that falls inside it (local = hf - edge.s0), so one
     clock drives the whole graph and splits/merges fall out for free */
  function setFlowEdges(hf) {
    if (!flow) return;
    flow.edges.forEach(function (e) {
      /* head and tail clamp to their OWN off-path windows: clamping the
         head at the tail's longer window drives its dashoffset negative
         once the edge completes, wrapping the dash pattern and parking a
         phantom head near the edge's start (the "straggler") */
      var raw = hf - e.s0;
      var lh = Math.max(0, Math.min(raw, e.len + FHEAD));
      var lt = Math.max(0, Math.min(raw, e.len + FTAIL));
      e.head.setAttribute('stroke-dashoffset', e.len + 3 * FHEAD - lh);
      e.tail.setAttribute('stroke-dashoffset', e.len + 3 * FTAIL - lt);
    });
  }

  /* point-list -> path data / arclength (flow edge helpers) */
  function ptsD(pp) {
    return pp.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
  }
  function ptsLen(pp) {
    var L = 0;
    for (var i = 1; i < pp.length; i++) L += Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]);
    return L;
  }
  function flowPath(group, d) {
    var el = document.createElementNS(SVGNS, 'path');
    el.setAttribute('d', d);
    group.appendChild(el);
    return el;
  }

  /* orthogonal edge route with 45deg chamfer corner cuts — the machined
     sibling of n8n's beziers. mode 'h': source right port -> target left
     port; mode 'v': bottom port -> top port. Straight when aligned. */
  function flowRoute(p1, p2, mode, c) {
    var pp = [p1];
    if (mode === 'h') {
      if (Math.abs(p2[1] - p1[1]) < 2) { pp.push(p2); return pp; }
      var jx = (p1[0] + p2[0]) / 2, sgn = p2[1] > p1[1] ? 1 : -1;
      pp.push([jx - c, p1[1]]);
      pp.push([jx, p1[1] + sgn * c]);
      pp.push([jx, p2[1] - sgn * c]);
      pp.push([jx + c, p2[1]]);
      pp.push(p2);
    } else {
      if (Math.abs(p2[0] - p1[0]) < 2) { pp.push(p2); return pp; }
      var jy = (p1[1] + p2[1]) / 2, sgx = p2[0] > p1[0] ? 1 : -1;
      pp.push([p1[0], jy - c]);
      pp.push([p1[0] + sgx * c, jy]);
      pp.push([p2[0] - sgx * c, jy]);
      pp.push([p2[0], jy + c]);
      pp.push(p2);
    }
    return pp;
  }

  /* brief teal heat on any glintable element (SVG node/index or HTML rail
     octagon) — .5s settle back, matching the CSS transition contract */
  function glint(el) {
    el.classList.add('glint');
    setTimeout(function () { el.classList.remove('glint'); }, 520);
  }

  function octagonNode(x, y, scale) {
    var el = document.createElementNS(SVGNS, 'path');
    el.setAttribute('d', OCT);
    el.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' +
      (scale ? ' scale(' + scale + ')' : ''));
    el.setAttribute('class', 'sig-node');
    nodesG.appendChild(el);
    return el;
  }

  /* section index riding the bus: 9px right of the node center (5.5px off
     the octagon edge), optically centered on the node's latitude */
  function idxLabel(x, y, text) {
    var t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', (x + 9).toFixed(1));
    t.setAttribute('y', y.toFixed(1));
    t.setAttribute('dominant-baseline', 'central');
    t.textContent = text;
    idxG.appendChild(t);
    return t;
  }

  /* kicker wording riding the bus: one row per section —
     [node] / 0n KICKER — the kicker sits immediately after its index
     (index right edge + 14px) at every wide width, so the row stays a
     tight unit no matter how far the centered container drifts right */
  function kickLabel(x, y, text) {
    var t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', x.toFixed(1));
    t.setAttribute('y', y.toFixed(1));
    t.setAttribute('dominant-baseline', 'central');
    t.textContent = text;
    kickG.appendChild(t);
    return t;
  }

  function build() {
    var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    var vw = document.documentElement.clientWidth;
    svg.setAttribute('width', vw);
    svg.setAttribute('height', docH);
    svg.setAttribute('viewBox', '0 0 ' + vw + ' ' + docH);

    var sy = window.scrollY || window.pageYOffset || 0;
    var icon = document.querySelector('.brand-icon');
    var headerEl = document.querySelector('.site-header');
    var ir = icon.getBoundingClientRect();
    var hr = headerEl.getBoundingClientRect();
    /* header is sticky at the top of the document, so its document-top is 0;
       measure the icon relative to it to stay scroll-independent */
    var x0 = ir.left + ir.width / 2;
    var y0 = (ir.top - hr.top) + ir.height + 1;

    var cont = document.querySelector('main .container');
    var cLeft = cont.getBoundingClientRect().left;
    var wide = cLeft > 70;
    var g = wide ? Math.round(cLeft * 0.55) : 10;   /* gutter x; edge route on mobile */
    var jog = wide ? 14 : 6;

    /* indices ride the bus only when a real gutter exists; on the edge
       route (~10px) there's no room before content, so the inline spans
       in the kickers take over (CSS keys off this class) */
    document.body.classList.toggle('idx-on-bus', wide);

    var pts = [[x0, y0]];
    pts.push([x0, y0 + 30]);
    pts.push([g, y0 + 30 + (x0 - g) / TAN60]);      /* diagonal into the gutter */

    nodesG.textContent = '';
    idxG.textContent = '';
    kickG.textContent = '';
    nodeMeta = [];
    var pending = [];
    /* junctions come from the page's [data-circuit-node] elements, in
       document order — see the registration interface in the header
       comment. Every section keeps its node at every width; `lift`
       kickers leave the text flow on wide viewports and render beside
       their index instead (the HTML copy keeps its layout slot via
       visibility:hidden, so the measured latitude and the vertical
       rhythm both hold). */
    var anchors = document.querySelectorAll('[data-circuit-node]');
    anchors.forEach(function (a) {
      var idxSpan = a.querySelector('.sec-index');
      var label = a.getAttribute('data-circuit-label') || (idxSpan ? idxSpan.textContent : '');
      var lift = a.classList.contains('kicker') && idxSpan &&
                 a.getAttribute('data-circuit-lift') !== 'off';
      var r = a.getBoundingClientRect();
      var yj = r.top + sy + r.height / 2;
      var dyj = jog / TAN60;
      pts.push([g, yj - 16]);
      pts.push([g + jog, yj - 16 + dyj]);           /* 60deg detour out */
      pending.push({
        ix: pts.length - 1, x: g + jog, y: yj,
        label: wide ? label : '',
        kick: (wide && lift) ? kickerText(a) : ''
      });
      pts.push([g + jog, yj + 16 - dyj]);           /* offset run (node lives here) */
      pts.push([g, yj + 16]);                       /* 60deg back to the main run */
    });

    /* terminate at the primary CTA (60deg approach into the button edge);
       if a page has no terminal, the bus simply ends after its last jog */
    var btn = terminal ? terminal.querySelector('.btn') : null;
    if (btn) {
      var br = btn.getBoundingClientRect();
      var ctaY = br.top + sy + br.height / 2;
      var run = wide ? 46 : 34;
      pts.push([g, ctaY - run / TAN60]);
      pts.push([g + run, ctaY]);                    /* 60deg approach */
      pts.push([br.left - 1, ctaY]);                /* terminate AT the button edge */
    }

    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    base.setAttribute('d', d);
    tail.setAttribute('d', d);
    head.setAttribute('d', d);

    var acc = [0];
    totalLen = 0;
    for (var i = 1; i < pts.length; i++) {
      totalLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      acc.push(totalLen);
    }
    pending.forEach(function (n) {
      var el = octagonNode(n.x, n.y);
      var lab = n.label ? idxLabel(n.x, n.y, n.label) : null;
      /* kicker immediately after the index: measured right edge + 14px */
      if (n.kick && lab) kickLabel(n.x + 9 + lab.getBBox().width + 14, n.y, n.kick);
      nodeMeta.push({
        el: el,
        s: acc[n.ix] + (n.y - pts[n.ix][1]),        /* arc length at the node */
        idx: lab
      });
    });

    tail.setAttribute('stroke-dasharray', TAILLEN + ' ' + (totalLen + TAILLEN));
    head.setAttribute('stroke-dasharray', HEAD + ' ' + (totalLen + HEAD));
    setPacket(0);

    /* ---- branch geometry (see THE BRANCH in the header) ----
       Measured, like everything else, from the real DOM: the rail latitude
       comes from the first .crisp-node's center (the markers sit ON the
       rail line), so no CSS offsets are duplicated here. Wide mode only —
       in the stacked layout the rail is display:none and the fork's bus
       geometry doesn't exist. */
    branch = null;
    if (bBase) {
      bBase.removeAttribute('d');
      bTail.removeAttribute('d');
      bHead.removeAttribute('d');
    }
    var railEl = document.querySelector('[data-circuit-branch]');
    var railNodes = (railEl && bBase) ? railEl.querySelectorAll('.crisp-node') : [];
    if (wide && railNodes.length && getComputedStyle(railEl).display !== 'none') {
      var tr = railEl.getBoundingClientRect();
      var n0 = railNodes[0].getBoundingClientRect();
      var railY = n0.top + sy + n0.height / 2;
      var endX = tr.right + 3;                      /* the arrowhead tip */
      /* fork arclength: where the rail latitude crosses the bus's vertical
         run at x = g (always between two junction jogs, never inside one) */
      var s0 = null;
      for (var bi = 1; bi < pts.length; bi++) {
        if (Math.abs(pts[bi - 1][0] - g) < .6 && Math.abs(pts[bi][0] - g) < .6 &&
            pts[bi - 1][1] <= railY && railY <= pts[bi][1]) {
          s0 = acc[bi - 1] + (railY - pts[bi - 1][1]);
          break;
        }
      }
      if (s0 !== null) {
        var bd = 'M' + g + ' ' + railY.toFixed(1) + ' L' + endX.toFixed(1) + ' ' + railY.toFixed(1);
        /* static extension only — butt-jointed exactly where the CSS rail
           begins (overlapping would double the 30%-alpha ink into a seam) */
        bBase.setAttribute('d', 'M' + g + ' ' + railY.toFixed(1) + ' L' + tr.left.toFixed(1) + ' ' + railY.toFixed(1));
        bTail.setAttribute('d', bd);
        bHead.setAttribute('d', bd);
        var bLen = endX - g;
        bTail.setAttribute('stroke-dasharray', BTAIL + ' ' + (bLen + BTAIL));
        bHead.setAttribute('stroke-dasharray', BHEAD + ' ' + (bLen + BHEAD));
        branch = {
          s0: s0, len: bLen,
          fork: octagonNode(g, railY, .72),         /* smaller tap-point octagon */
          nodes: [].map.call(railNodes, function (n) {
            var r = n.getBoundingClientRect();
            return { el: n, s: (r.left + r.width / 2) - g };
          })
        };
        setBranchPacket(0);
      }
    }

    /* ---- flow geometry (see THE FLOW in the header) ----
       Tiles come from the real DOM; orientation is inferred from nodes
       1->2 so the CSS grid can reflow horizontal <-> vertical freely.
       Runs at every width — the diagram is visible on mobile. */
    flow = null;
    if (fBaseG) {
      fBaseG.textContent = '';
      fTailG.textContent = '';
      fHeadG.textContent = '';
    }
    var flowEl = document.querySelector('[data-circuit-flow]');
    if (flowEl && fBaseG) {
      var tiles = {};
      flowEl.querySelectorAll('.flow-node').forEach(function (n) {
        var tr2 = n.querySelector('.flow-tile').getBoundingClientRect();
        tiles[n.getAttribute('data-flow-id')] = {
          el: n.querySelector('.flow-tile'),
          l: tr2.left, r: tr2.right, t: tr2.top + sy, b: tr2.bottom + sy,
          cx: tr2.left + tr2.width / 2, cy: tr2.top + sy + tr2.height / 2
        };
      });
      var t1 = tiles['1'], t2 = tiles['2'];
      if (t1 && t2) {
        var mode = Math.abs(t2.cx - t1.cx) >= Math.abs(t2.cy - t1.cy) ? 'h' : 'v';
        /* fork arclength: where node 1's latitude crosses the bus's
           vertical run (same search as the branch fork) */
        var fy = t1.cy, fs0 = null;
        for (var fi = 1; fi < pts.length; fi++) {
          if (Math.abs(pts[fi - 1][0] - g) < .6 && Math.abs(pts[fi][0] - g) < .6 &&
              pts[fi - 1][1] <= fy && fy <= pts[fi][1]) {
            fs0 = acc[fi - 1] + (fy - pts[fi - 1][1]);
            break;
          }
        }
        if (fs0 !== null) {
          var CH = 8;                             /* corner cut size */
          var seen = {};                          /* shared-port base-ink dedupe */
          var dist = { 1: (t1.l - 1) - g };       /* pulse arclength at each node's arrival */
          var entry = [[g, fy], [t1.l - 1, fy]];  /* bus -> node 1 extension */
          var edges = [{ pp: entry, base: entry, s0: 0 }];
          var spec = (flowEl.getAttribute('data-flow-edges') || '').split(/\s+/).filter(Boolean);
          spec.forEach(function (sp) {
            var ab = sp.split('>'), A = tiles[ab[0]], B = tiles[ab[1]];
            if (!A || !B) return;
            var p1 = mode === 'h' ? [A.r + 1, A.cy] : [A.cx, A.b + 1];
            var p2 = mode === 'h' ? [B.l - 1, B.cy] : [B.cx, B.t - 1];
            var pp = flowRoute(p1, p2, mode, CH);
            /* base ink only where no earlier edge already drew this port
               run — the pulse paths stay full so heads split and merge */
            var bpp = pp.slice();
            if (seen['s' + ab[0]] && bpp.length > 2) bpp = bpp.slice(1);
            if (seen['t' + ab[1]] && bpp.length > 2) bpp = bpp.slice(0, -1);
            seen['s' + ab[0]] = true;
            seen['t' + ab[1]] = true;
            var e = { pp: pp, base: bpp, s0: dist[ab[0]] || 0 };
            edges.push(e);
            var arr = e.s0 + ptsLen(pp);
            if (dist[ab[1]] === undefined || arr < dist[ab[1]]) dist[ab[1]] = arr;
          });
          /* outlet: short stub + machined arrowhead off the final node */
          var lastId = spec.length ? spec[spec.length - 1].split('>')[1] : '1';
          var TL = tiles[lastId];
          var stub = mode === 'h'
            ? [[TL.r + 1, TL.cy], [TL.r + 37, TL.cy]]
            : [[TL.cx, TL.b + 1], [TL.cx, TL.b + 37]];
          edges.push({ pp: stub, base: stub, s0: dist[lastId] || 0 });
          var tip = stub[1];
          var arrow = document.createElementNS(SVGNS, 'path');
          arrow.setAttribute('d', mode === 'h'
            ? 'M' + tip[0].toFixed(1) + ' ' + (tip[1] - 3.5).toFixed(1) + ' L' + (tip[0] + 6).toFixed(1) + ' ' + tip[1].toFixed(1) + ' L' + tip[0].toFixed(1) + ' ' + (tip[1] + 3.5).toFixed(1) + ' Z'
            : 'M' + (tip[0] - 3.5).toFixed(1) + ' ' + tip[1].toFixed(1) + ' L' + tip[0].toFixed(1) + ' ' + (tip[1] + 6).toFixed(1) + ' L' + (tip[0] + 3.5).toFixed(1) + ' ' + tip[1].toFixed(1) + ' Z');
          arrow.setAttribute('class', 'sig-flow-arrow');
          nodesG.appendChild(arrow);
          /* strokes: one base path + one tail/head pair per edge */
          var fTotal = 0;
          edges.forEach(function (e) {
            e.len = ptsLen(e.pp);
            flowPath(fBaseG, ptsD(e.base));
            e.tail = flowPath(fTailG, ptsD(e.pp));
            e.head = flowPath(fHeadG, ptsD(e.pp));
            e.tail.setAttribute('stroke-dasharray', FTAIL + ' ' + (e.len + FTAIL));
            e.head.setAttribute('stroke-dasharray', FHEAD + ' ' + (e.len + FHEAD));
            fTotal = Math.max(fTotal, e.s0 + e.len);
          });
          flow = {
            s0: fs0, edges: edges, total: fTotal + FTAIL,
            fork: octagonNode(g, fy, .72),
            nodes: Object.keys(tiles).map(function (k) {
              return { el: tiles[k].el, s: dist[k] || 0 };
            })
          };
          setFlowEdges(0);
        }
      }
    }
  }

  /* packet scheduler: one traversal, then a rest so a full cycle lands
     near 8s regardless of path length; node + index glints fire as the
     head passes; the CTA terminal pulses when the packet arrives.
     The branch child pulse (if the page built one) spawns when the main
     head crosses the fork and runs simultaneously at the same px/ms —
     both packets are driven by this ONE rAF loop, dashoffset only.
     The main packet's own timing and behavior are independent of it. */
  var timer = null;
  function launch() {
    var DUR = Math.max(4200, Math.min(6000, totalLen / 0.72));
    var span = totalLen + TAILLEN;
    var speed = span / DUR;                       /* px per ms, shared by the child */
    var t0 = null;
    var fired = nodeMeta.map(function () { return false; });
    var ctaFired = false;
    var bT0 = null;                               /* branch spawn timestamp */
    var bFired = branch ? branch.nodes.map(function () { return false; }) : [];
    var bDone = !branch;
    var fT0 = null;                               /* flow spawn timestamp */
    var fFired = flow ? flow.nodes.map(function () { return false; }) : [];
    var fDone = !flow;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / DUR, 1);
      var h = p * span;
      setPacket(h);
      nodeMeta.forEach(function (n, i) {
        if (!fired[i] && h >= n.s + HEAD / 2) {
          fired[i] = true;
          glint(n.el);
          if (n.idx) glint(n.idx);
        }
      });
      /* --- branch: spawn at the fork, glint C..P in sequence, expire at the arrowhead --- */
      if (!bDone) {
        if (bT0 === null && h >= branch.s0 + HEAD / 2) {
          bT0 = ts;
          glint(branch.fork);
        }
        if (bT0 !== null) {
          var hb = Math.min((ts - bT0) * speed, branch.len + BTAIL);
          branch.nodes.forEach(function (n, i) {
            if (!bFired[i] && hb >= n.s + BHEAD / 2) {
              bFired[i] = true;
              glint(n.el);
            }
          });
          if (hb >= branch.len + BTAIL) {
            bDone = true;
            setBranchPacket(0);
          } else {
            setBranchPacket(hb);
          }
        }
      }
      /* --- flow: spawn at its fork, split at the branches, glint each
         tile on arrival, expire past the outlet arrowhead --- */
      if (!fDone && !flow) fDone = true;        /* resize rebuild removed the flow mid-run */
      if (!fDone) {
        if (fT0 === null && h >= flow.s0 + HEAD / 2) {
          fT0 = ts;
          glint(flow.fork);
        }
        if (fT0 !== null) {
          var hf = Math.min((ts - fT0) * speed * FLOWK, flow.total);
          flow.nodes.forEach(function (n, i) {
            if (!fFired[i] && hf >= n.s + FHEAD / 2) {
              fFired[i] = true;
              glint(n.el);
            }
          });
          if (hf >= flow.total) {
            fDone = true;
            setFlowEdges(0);
          } else {
            setFlowEdges(hf);
          }
        }
      }
      if (terminal && !ctaFired && h >= totalLen + 2) {
        ctaFired = true;
        terminal.classList.add('arrived');
        setTimeout(function () { terminal.classList.remove('arrived'); }, 620);
      }
      if (p < 1 || !fDone) {
        requestAnimationFrame(step);
      } else {
        setPacket(0);
        setBranchPacket(0);                       /* safety: never strand a child pulse */
        setFlowEdges(0);
        timer = setTimeout(launch, Math.max(2600, 8000 - DUR));
      }
    }
    requestAnimationFrame(step);
  }

  /* ============ 5. the flow's logo swap ============ */
  /* Every ~1.5s one workflow tile re-registers to a compatible service
     from its own data-flow-pool: never a mark already visible on another
     tile, never a tile mid-glint, never the same tile twice running.
     The blip itself is CSS steps() (see .flow-glyph.out/.in) — a relay
     switching, not a fade. Static under reduced motion. */
  var flowNodesAll = document.querySelectorAll('[data-circuit-flow] .flow-node');
  if (flowNodesAll.length && !reduce) {
    var fState = [].map.call(flowNodesAll, function (n) {
      var pool = (n.getAttribute('data-flow-pool') || '').split(/\s+/).filter(Boolean);
      return {
        tile: n.querySelector('.flow-tile'),
        glyphs: [].slice.call(n.querySelectorAll('.flow-glyph')),
        pool: pool,
        key: pool[0]
      };
    });
    var lastSwap = -1;
    var swapTick = function () {
      var visible = {};
      fState.forEach(function (s) { visible[s.key] = true; });
      for (var tries = 0; tries < 8; tries++) {
        var i = Math.floor(Math.random() * fState.length);
        var st = fState[i];
        if (i === lastSwap || st.tile.classList.contains('glint')) continue;
        var cands = st.pool.filter(function (k) { return k !== st.key && !visible[k]; });
        if (!cands.length) continue;
        var next = cands[Math.floor(Math.random() * cands.length)];
        var out = st.glyphs[0].classList.contains('on') ? st.glyphs[0] : st.glyphs[1];
        var inc = out === st.glyphs[0] ? st.glyphs[1] : st.glyphs[0];
        inc.querySelector('use').setAttribute('href', '#lg-' + next);
        out.classList.remove('on');
        out.classList.add('out');
        inc.classList.add('in', 'on');
        setTimeout(function () {
          out.classList.remove('out');
          inc.classList.remove('in');
        }, 320);
        st.key = next;
        lastSwap = i;
        break;
      }
      setTimeout(swapTick, 1150 + Math.random() * 750);
    };
    setTimeout(swapTick, 2400);
  }

  build();
  window.addEventListener('load', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(build, 180);
  });
  if (!reduce) timer = setTimeout(launch, 1400);
})();
