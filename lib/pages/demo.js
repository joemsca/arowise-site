// The demo screen (choice -> upload -> working). Served by api/demo.js only when the live mode is
// `demo`; everything else lands on booking. Client JS resizes the photo in the browser (max 1600px,
// JPEG), POSTs it as base64 JSON to /api/run, reads the SSE stream and lights one bus node per
// server step, then moves to /r/<id>. Copy comes from lib/copy.js; nothing prospect-facing is
// written here.
import { COPY } from '../copy.js';
import { shell, esc, busSvg, BUS_X } from './shell.js';

export function demoPage({ cfg, spot, bookingUrl, turnstileSiteKey }) {
  const c = COPY;
  const enabled = (cfg.buttons || []).filter((b) => b.enabled && c.choice.buttons[b.id]);
  const buttons = enabled.map((b) => `<button class="card" type="button" data-button="${esc(b.id)}"><span class="t">${esc(c.choice.buttons[b.id].label)}</span><span class="h">${esc(c.choice.buttons[b.id].helper)}</span></button>`).join('');
  const ts = turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}" data-theme="dark" data-size="flexible"></div>` : '';
  const tsHead = turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '';
  const body = `
  <section id="choice">
    <p class="kicker">${esc(c.choice.kicker)}</p>
    <h1>${esc(c.choice.h1_plain)}<span class="accent">${esc(c.choice.h1_accent)}</span></h1>
    <p class="lede">${esc(c.choice.sub)}</p>
    <div class="choice">${buttons || `<a class="card" href="${esc(bookingUrl)}"><span class="t">${esc(c.booking.button)}</span></a>`}</div>
    <p class="small">${esc(c.choice.footer_prefix)}<a href="${esc(bookingUrl)}" data-book>${esc(c.choice.footer_link)}</a></p>
  </section>

  <section id="upload" class="hide">
    <p class="kicker">${esc(c.choice.kicker)}</p>
    <h2>${esc(c.upload.heading)}</h2>
    <p class="lede">${esc(c.upload.helper)}</p>
    <label class="file" id="file-label"><img id="preview" alt="" class="hide" /><span id="file-text">${esc(c.upload.choose)}</span><input type="file" id="file" accept="image/*" /></label>
    ${ts}
    <button class="btn btn-primary" id="run" type="button" disabled>${esc(c.upload.button)}</button>
    <p class="small" style="margin-top:14px">${esc(c.upload.privacy)} <a href="/privacy-demo">${esc(c.upload.privacy_link)}</a></p>
  </section>

  <section id="working" class="hide">
    <p class="kicker">${esc(c.results.kicker)}</p>
    ${busSvg()}
    <ol class="steps">${c.steps.map((s, i) => `<li data-step="${i + 1}"><span class="i">/ 0${i + 1}</span>${esc(s)}</li>`).join('')}</ol>
  </section>

  <section id="problem" class="hide">
    <div class="msg err"><p id="problem-text" style="margin:0"></p></div>
    <button class="btn btn-ghost hide" id="retry" type="button">${esc(c.errors.cannot_tell_button)}</button>
    <a class="btn btn-primary hide" id="problem-book" href="${esc(bookingUrl)}">${esc(c.errors.book_button)}</a>
  </section>

  <script>
  (function () {
    var SPOT = ${JSON.stringify(spot)};
    var BUS_X = ${JSON.stringify(BUS_X)};
    var ERR = ${JSON.stringify(c.errors)};
    var UP = ${JSON.stringify({ choose: c.upload.choose, chosen: c.upload.chosen })};
    var $ = function (s) { return document.querySelector(s); };
    var show = function (id) { ['choice', 'upload', 'working', 'problem'].forEach(function (k) { $('#' + k).classList.toggle('hide', k !== id); }); window.scrollTo(0, 0); };
    var beacon = function (event, extra) { try { fetch('/api/event', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ event: event, spot: SPOT }, extra || {})) }); } catch (e) {} };
    var image = null, mediaType = 'image/jpeg';

    document.querySelectorAll('[data-button]').forEach(function (b) {
      b.addEventListener('click', function () {
        beacon('button_tap', { button: b.dataset.button });
        if (b.dataset.button === 'screenshot') show('upload');
      });
    });
    var bk = $('[data-book]'); if (bk) bk.addEventListener('click', function () { beacon('book_tap', { button: 'choice' }); });

    $('#file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var url = URL.createObjectURL(f); var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        var data = cv.toDataURL('image/jpeg', 0.82);
        image = data.split(',')[1]; mediaType = 'image/jpeg';
        var p = $('#preview'); p.src = data; p.classList.remove('hide');
        $('#file-text').textContent = UP.chosen; $('#file-label').classList.add('ready'); $('#run').disabled = false;
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { problem(ERR.bad_file, 'retry'); };
      img.src = url;
    });

    function light(step) {
      document.querySelectorAll('.bus .node').forEach(function (n) { var s = +n.dataset.step; n.classList.toggle('on', s <= step); n.classList.toggle('live', s === step); });
      document.querySelectorAll('.steps li').forEach(function (li) { var s = +li.dataset.step; li.classList.toggle('on', s <= step); li.classList.toggle('live', s === step); });
      var x = step >= 4 ? 322 : (BUS_X[step - 1] || 32);
      $('#bus-lit').style.strokeDashoffset = String(290 - (x - 32));
      if (step >= 4) $('#bus-head').classList.add('on');
    }

    function problem(text, kind) {
      $('#problem-text').textContent = text;
      $('#retry').classList.toggle('hide', kind !== 'retry');
      $('#problem-book').classList.toggle('hide', kind !== 'book');
      show('problem');
    }
    $('#retry').addEventListener('click', function () { image = null; $('#run').disabled = true; $('#preview').classList.add('hide'); $('#file-text').textContent = UP.choose; $('#file-label').classList.remove('ready'); $('#file').value = ''; show('upload'); });

    $('#run').addEventListener('click', function () {
      if (!image) return;
      var token = '';
      try { if (window.turnstile) token = window.turnstile.getResponse() || ''; } catch (e) {}
      show('working'); light(0);
      beacon('path_start', { button: 'screenshot' });
      fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: image, media_type: mediaType, spot: SPOT, turnstile: token }) })
        .then(function (res) {
          if (!res.ok || !res.body) { return res.json().catch(function () { return {}; }).then(function (j) { handle(j.error ? j : { error: 'server' }); }); }
          var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
          function pump() {
            return reader.read().then(function (r) {
              buf += dec.decode(r.value || new Uint8Array(), { stream: !r.done });
              var parts = buf.split('\\n\\n'); buf = parts.pop();
              parts.forEach(function (p) { var line = p.split('\\n').find(function (l) { return l.indexOf('data: ') === 0; }); if (line) { try { handle(JSON.parse(line.slice(6))); } catch (e) {} } });
              if (!r.done) return pump();
            });
          }
          return pump();
        })
        .catch(function () { handle({ error: 'server' }); });
    });

    var finished = false;
    function handle(ev) {
      if (finished) return;
      if (ev.step) { light(ev.step); return; }
      if (ev.result_id) { finished = true; setTimeout(function () { location.replace('/r/' + ev.result_id); }, 650); return; }
      if (ev.error) {
        finished = true;
        if (ev.error === 'cannot_tell') { finished = false; problem(ERR.cannot_tell, 'retry'); }
        else if (ev.error === 'cap') problem(ERR.cap, 'book');
        else if (ev.error === 'bad_file') { finished = false; problem(ERR.bad_file, 'retry'); }
        else problem(ERR.server, 'book');
      }
    }
    beacon('demo_view');
  })();
  </script>`;
  return shell({ title: c.choice.h1_plain + c.choice.h1_accent, body, extraHead: tsHead });
}
