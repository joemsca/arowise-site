// The results page /r/<id>: the plan, the ask (email me my results), then booking. Server-rendered
// from the stored result JSON. Also the "expired" page. Cal.com inline embed is prefilled with the
// name and email once the person has asked for their results, and the booking notes carry the /r link.
import { COPY } from '../copy.js';
import { shell, esc } from './shell.js';

const CAL_LINK = 'arowise/discovery';

export function expiredPage({ bookingUrl }) {
  const c = COPY;
  const body = `<section><p class="kicker">${esc(c.results.kicker)}</p><h1>${esc(c.results.expired_h)}</h1><p class="lede">${esc(c.results.expired_line)}</p><a class="btn btn-primary" href="${esc(bookingUrl)}">${esc(c.booking.button)}</a></section>`;
  return shell({ title: c.results.expired_h, body });
}

export function resultPage({ result, cfg, bookingUrl, resultsUrl, turnstileSiteKey }) {
  const c = COPY;
  const items = result.items || [];
  const picks = items.filter((i) => i.verdict === 'automate_now');
  const partly = items.filter((i) => i.verdict === 'partly');
  const human = items.filter((i) => i.verdict === 'keep_human');
  const hours = cfg.hours_approved || {};
  const card = (i, n) => {
    const h = hours[i.service_id];
    const hrs = h ? `<p class="hrs">${esc(c.results.hours(h.low, h.high))}</p>` : '';
    return `<article class="card"><p class="n">/ 0${n}</p><h3>${esc(i.service_name)}</h3><p class="q">${esc(c.results.from_list)} <b>"${esc(i.task)}"</b></p>${i.why ? `<p class="why">${esc(i.why)}</p>` : ''}${hrs}</article>`;
  };
  let n = 0;
  const lead = result.lead || null;
  const ts = turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}" data-theme="dark" data-size="flexible"></div>` : '';
  const tsHead = turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '';
  const notes = `From the flyer demo: ${resultsUrl} (spot ${result.spot || 'unknown'})`;
  const bookingWithNotes = (() => { try { const u = new URL(bookingUrl); u.searchParams.set('notes', notes); if (lead) { u.searchParams.set('name', lead.first_name); u.searchParams.set('email', lead.email); } return u.toString(); } catch { return bookingUrl; } })();

  const leadBlock = lead
    ? `<div class="msg" id="lead-state"><p style="margin:0">${esc(lead.email_status === 'sent' ? c.lead.sent : lead.email_status === 'already' ? c.lead.already(lead.email) : c.lead.refused)}</p></div>`
    : `<form id="lead" novalidate>
        <label for="fn">${esc(c.lead.first_name)}</label><input type="text" id="fn" name="first_name" autocomplete="given-name" maxlength="60" required />
        <label for="em">${esc(c.lead.email)}</label><input type="email" id="em" name="email" autocomplete="email" inputmode="email" maxlength="120" required />
        <label for="bn">${esc(c.lead.business)}</label><input type="text" id="bn" name="business_name" autocomplete="organization" maxlength="80" required />
        <label class="chk"><input type="checkbox" id="opt" name="opt_in" /> <span>${esc(c.lead.opt_in)}</span></label>
        ${ts}
        <button class="btn btn-primary" type="submit" id="send">${esc(c.lead.button)}</button>
        <p class="small" style="margin-top:12px">${esc(c.lead.under)} <a href="/privacy-demo">${esc(c.lead.privacy_link)}</a></p>
        <div class="msg hide" id="lead-state"><p style="margin:0" id="lead-text"></p></div>
      </form>`;

  const body = `
  <section>
    <p class="kicker">${esc(c.results.kicker)}</p>
    <h1>${esc(c.results.h1_plain)}<span class="accent">${esc(c.results.h1_accent)}</span></h1>
    <p class="lede">${esc(c.results.intro(result.task_count || items.length))}</p>
    <div class="cards">${picks.slice(0, 3).map((i) => card(i, ++n)).join('')}</div>
    ${partly.length ? `<h2>${esc(c.results.partly_h)}</h2><p class="lede">${esc(c.results.partly_line)}</p><div class="cards">${partly.slice(0, 3).map((i) => card(i, ++n)).join('')}</div>` : ''}
    ${human.length ? `<h2>${esc(c.results.human_h)}</h2><p class="lede">${esc(c.results.human_line)}</p><ul class="plain">${human.slice(0, 6).map((i) => `<li>${esc(i.task)}</li>`).join('')}</ul>` : ''}
    <button class="btn btn-ghost" type="button" id="save">${esc(c.results.save)}</button>
  </section>

  <section id="ask">
    <h2>${esc(c.lead.heading)}</h2>
    <p class="lede">${esc(c.lead.helper)}</p>
    ${leadBlock}
  </section>

  <section id="book">
    <p class="kicker">${esc(c.booking.kicker)}</p>
    <h2>${esc(c.booking.h2)}</h2>
    <p class="lede">${esc(c.booking.body)}</p>
    <a class="btn btn-primary" id="book-link" href="${esc(bookingWithNotes)}" data-book>${esc(c.booking.button)}</a>
    <div class="cal" id="cal-inline"></div>
  </section>

  <script>
  (function () {
    var RID = ${JSON.stringify(result.id)}, URLX = ${JSON.stringify(resultsUrl)}, SPOT = ${JSON.stringify(result.spot || '')};
    var L = ${JSON.stringify({ sent: c.lead.sent, already: c.lead.already('{email}'), refused: c.lead.refused, invalid: c.lead.invalid, saved: c.results.saved, save: c.results.save })};
    var NOTES = ${JSON.stringify(notes)};
    var LEAD = ${JSON.stringify(lead ? { name: lead.first_name, email: lead.email } : null)};
    var $ = function (s) { return document.querySelector(s); };
    var beacon = function (event, extra) { try { fetch('/api/event', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ event: event, spot: SPOT, result_id: RID }, extra || {})) }); } catch (e) {} };

    $('#save').addEventListener('click', function () {
      beacon('save_tap');
      if (navigator.share) { navigator.share({ title: document.title, url: URLX }).catch(function () {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(URLX) : Promise.reject()).then(function () { $('#save').textContent = L.saved; setTimeout(function () { $('#save').textContent = L.save; }, 2200); }).catch(function () { prompt('Copy this link', URLX); });
    });
    var bl = $('#book-link'); if (bl) bl.addEventListener('click', function () { beacon('book_tap', { button: 'results' }); });

    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    function mountCal(prefill) {
      var cfg = { notes: NOTES, theme: 'dark', utm_source: 'flyer', utm_medium: 'qr', utm_campaign: 'flyer-qr', utm_content: SPOT || 'unknown' };
      if (prefill) { cfg.name = prefill.name; cfg.email = prefill.email; }
      Cal('init', { origin: 'https://cal.com' });
      Cal('inline', { elementOrSelector: '#cal-inline', calLink: ${JSON.stringify(CAL_LINK)}, layout: 'month_view', config: cfg });
      Cal('ui', { theme: 'dark', styles: { branding: { brandColor: '#00C6CB' } }, hideEventTypeDetails: false });
    }
    mountCal(LEAD);

    var form = $('#lead');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fn = $('#fn').value.trim(), em = $('#em').value.trim(), bn = $('#bn').value.trim();
      var state = $('#lead-state'), text = $('#lead-text');
      if (!fn || !bn || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(em)) { text.textContent = L.invalid; state.classList.remove('hide'); return; }
      var token = ''; try { if (window.turnstile) token = window.turnstile.getResponse() || ''; } catch (x) {}
      $('#send').disabled = true;
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: RID, first_name: fn, email: em, business_name: bn, opt_in: $('#opt').checked, turnstile: token, spot: SPOT }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var s = j.email_status;
          text.textContent = s === 'sent' ? L.sent : s === 'already' ? L.already.replace('{email}', j.email || em) : L.refused;
          state.classList.remove('hide');
          if (j.ok) { form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; }); var u = new URL($('#book-link').href); u.searchParams.set('name', fn); u.searchParams.set('email', em); $('#book-link').href = u.toString(); $('#cal-inline').innerHTML = ''; mountCal({ name: fn, email: em }); }
          else $('#send').disabled = false;
        })
        .catch(function () { text.textContent = L.refused; state.classList.remove('hide'); $('#send').disabled = false; });
    });
  })();
  </script>`;
  return shell({ title: c.results.h1_plain + c.results.h1_accent, body, extraHead: tsHead });
}
