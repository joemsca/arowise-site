/* Small Arms Pistol Academy - site.js
   Shared behavior for every page: the mobile menu, where the search box lives (top bar on wide
   screens, inside the menu on small ones), site search (client-side, reads /js/search-index.json),
   and the footer year. No dependencies. */
(function () {
  'use strict';
  var BASE = document.documentElement.getAttribute('data-base') || '';
  var WIDE = window.matchMedia('(min-width: 1200px)');

  /* ---- Mobile menu ---------------------------------------------------------------------- */
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('site-menu');
  function setMenu(open) {
    if (!toggle || !menu) return;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });
    document.addEventListener('click', function (e) { if (menu.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false); });
  }

  /* ---- Search box placement ------------------------------------------------------------- */
  var form = document.querySelector('form.site-search');
  var slot = document.querySelector('.menu-search-slot');
  var tools = document.querySelector('.hd-tools');
  function placeSearch() {
    if (!form || !slot || !tools) return;
    if (WIDE.matches) { if (form.parentNode !== tools) tools.insertBefore(form, tools.firstChild); }
    else if (form.parentNode !== slot) slot.appendChild(form);
  }
  placeSearch();
  if (WIDE.addEventListener) WIDE.addEventListener('change', placeSearch); else WIDE.addListener(placeSearch);

  /* ---- Search ----------------------------------------------------------------------------- */
  var index = null, loading = null;
  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch(BASE + '/js/search-index.json', { cache: 'force-cache' }).then(function (r) { return r.json(); }).then(function (j) { index = j; return j; });
    return loading;
  }
  function tokens(q) {
    return String(q).toLowerCase().replace(/[^a-z0-9&'" ]+/g, ' ').split(/\s+/).filter(function (t) { return t.length >= 2 && t !== 'the' && t !== 'and'; });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function search(q) {
    var toks = tokens(q);
    var phrase = String(q).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!toks.length && phrase.length < 2) return [];
    var out = [];
    index.forEach(function (p) {
      var title = p.title.toLowerCase(), text = p.text.toLowerCase(), kw = (p.keywords || '').toLowerCase();
      var score = 0, firstAt = -1;
      if (phrase.length >= 3) {
        if (title.indexOf(phrase) >= 0) score += 20;
        var at = text.indexOf(phrase);
        if (at >= 0) { score += 12; firstAt = at; }
        if (kw.indexOf(phrase) >= 0) score += 10;
      }
      toks.forEach(function (t) {
        if (title.indexOf(t) >= 0) score += 8;
        if (kw.indexOf(t) >= 0) score += 6;
        var n = 0, i = text.indexOf(t);
        while (i >= 0 && n < 6) { if (firstAt < 0) firstAt = i; n++; i = text.indexOf(t, i + t.length); }
        score += n;
      });
      if (score > 0) out.push({ page: p, score: score, at: firstAt });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.map(function (h) {
      var text = h.page.text, at = h.at < 0 ? 0 : h.at;
      var start = Math.max(0, at - 70), end = Math.min(text.length, at + 110);
      var snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
      var marked = esc(snippet);
      var all = toks.slice();
      if (phrase.length >= 3 && toks.length > 1) all.unshift(phrase);
      all.forEach(function (t) { marked = marked.replace(new RegExp('(' + escRe(esc(t)) + ')', 'ig'), '<mark>$1</mark>'); });
      return { url: h.page.url, title: h.page.title, snippet: marked };
    });
  }
  function render(container, q, hits, asPage) {
    if (!hits.length) {
      container.innerHTML = '<p class="search-empty">No results for “' + esc(q) + '”. Try another word, or text 716-397-5769 and ask.</p>';
      return;
    }
    var html = asPage ? '<p class="search-count">' + hits.length + (hits.length === 1 ? ' page' : ' pages') + ' mention “' + esc(q) + '”</p>' : '';
    hits.forEach(function (h) {
      html += '<a class="search-hit" href="' + esc(h.url) + '"><span class="hit-title">' + esc(h.title) + '</span><span class="hit-snippet">' + h.snippet + '</span></a>';
    });
    container.innerHTML = html;
  }

  var live = document.getElementById('search-live');
  var input = form ? form.querySelector('input[type="search"]') : null;
  var timer = null;
  if (input && live) {
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { live.hidden = true; live.innerHTML = ''; return; }
      timer = setTimeout(function () {
        loadIndex().then(function () { render(live, q, search(q).slice(0, 6), false); live.hidden = false; });
      }, 120);
    });
    input.addEventListener('focus', function () { loadIndex(); if (live.innerHTML && input.value.trim().length >= 2) live.hidden = false; });
    document.addEventListener('click', function (e) { if (!e.target.closest('form.site-search')) live.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') live.hidden = true; });
  }

  /* search page (/search?q=) */
  var pageInput = document.getElementById('search-page-input');
  var pageResults = document.getElementById('search-results');
  if (pageInput && pageResults) {
    var runPage = function (q) {
      pageInput.value = q;
      document.title = (q ? 'Search: ' + q : 'Search') + ' · Small Arms Pistol Academy';
      if (!q) { pageResults.innerHTML = '<p class="search-empty">Type a word above to search the site.</p>'; return; }
      loadIndex().then(function () { render(pageResults, q, search(q), true); });
    };
    var params = new URLSearchParams(location.search);
    runPage((params.get('q') || '').trim());
    pageInput.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = pageInput.value.trim();
      history.replaceState(null, '', BASE + '/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
      runPage(q);
    });
  }

  /* ---- Footer year ---------------------------------------------------------------------- */
  var y = document.querySelector('.site-footer .year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
