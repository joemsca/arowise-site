/* Small Arms Pistol Academy - services-calc.js
   The Firearm Services list: tick services, set quantities where a service is priced per side / per mag /
   per hour, and the estimated total updates. The prices live in the page markup (data-price, data-unit,
   data-max, data-min, data-plus, data-quote, data-tiers), so editing the list is editing the HTML.
   The "Text this list" link opens an SMS to 716-397-5769 with the selection written out. */
(function () {
  'use strict';
  var list = document.getElementById('services-list');
  if (!list) return;
  var SHOP_MIN = 25;
  var PHONE = '7163975769';
  var totalEl = document.getElementById('calc-total');
  var linesEl = document.getElementById('calc-lines');
  var emptyEl = document.getElementById('calc-empty');
  var minEl = document.getElementById('calc-min');
  var quoteEl = document.getElementById('calc-quote');
  var smsEl = document.getElementById('calc-sms');
  var clearEl = document.getElementById('calc-clear');

  function dollars(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function clampQty(item) {
    var q = item.querySelector('input.qty');
    if (!q) return 1;
    var min = Number(q.min || 1), max = Number(q.max || 999);
    var v = Math.floor(Number(q.value));
    if (!isFinite(v) || v < min) v = min;
    if (v > max) v = max;
    if (String(v) !== q.value) q.value = String(v);
    return v;
  }
  function tierPrice(spec, qty) { // "9:30,50:20,*:15" -> up to 9 at $30, up to 50 at $20, otherwise $15
    var parts = spec.split(',');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].split(':');
      if (p[0] === '*' || qty <= Number(p[0])) return Number(p[1]);
    }
    return 0;
  }

  function update() {
    var total = 0, plus = false, lines = [], quotes = [], smsLines = [];
    list.querySelectorAll('.svc').forEach(function (item) {
      var on = item.querySelector('.svc-check').checked;
      item.classList.toggle('is-on', on);
      if (!on) return;
      var name = item.querySelector('.svc-name').textContent.trim();
      if (item.hasAttribute('data-quote')) {
        quotes.push(name);
        lines.push({ name: name, amount: 'Quote' });
        smsLines.push(name + ' (quote)');
        return;
      }
      var qty = item.hasAttribute('data-unit') ? clampQty(item) : 1;
      var unit = item.hasAttribute('data-tiers') ? tierPrice(item.getAttribute('data-tiers'), qty) : Number(item.getAttribute('data-price'));
      var amount = unit * qty;
      total += amount;
      var isPlus = item.hasAttribute('data-plus');
      if (isPlus) plus = true;
      var label = name + (qty > 1 || item.hasAttribute('data-unit') && qty !== 1 ? ' × ' + qty : '');
      lines.push({ name: label, amount: (isPlus ? 'from ' : '') + dollars(amount) });
      smsLines.push(label + ' (' + (isPlus ? 'from ' : '') + dollars(amount) + ')');
    });

    var minApplied = total > 0 && total < SHOP_MIN;
    if (minApplied) total = SHOP_MIN;
    minEl.hidden = !minApplied;
    quoteEl.hidden = !quotes.length;
    quoteEl.querySelector('span').textContent = quotes.join(', ');
    linesEl.innerHTML = lines.map(function (l) { return '<li><span>' + esc(l.name) + '</span><span>' + esc(l.amount) + '</span></li>'; }).join('');
    emptyEl.hidden = lines.length > 0;
    totalEl.textContent = dollars(total) + (plus ? '+' : '');

    if (lines.length) {
      var body = 'Hi Michael, I’m interested in these firearm services: ' + smsLines.join('; ') + '. Estimated total ' + dollars(total) + (plus ? '+' : '') + (quotes.length ? ' plus a quote for ' + quotes.join(', ') : '') + '.';
      smsEl.setAttribute('href', 'sms:' + PHONE + '?&body=' + encodeURIComponent(body));
      smsEl.setAttribute('aria-disabled', 'false');
    } else {
      smsEl.setAttribute('href', 'sms:' + PHONE);
      smsEl.setAttribute('aria-disabled', 'true');
    }
  }

  list.addEventListener('change', update);
  list.addEventListener('input', function (e) { if (e.target.matches('input.qty')) update(); });
  smsEl.addEventListener('click', function (e) { if (smsEl.getAttribute('aria-disabled') === 'true') e.preventDefault(); });
  clearEl.addEventListener('click', function () {
    list.querySelectorAll('.svc-check').forEach(function (c) { c.checked = false; });
    list.querySelectorAll('input.qty').forEach(function (q) { q.value = q.min || '1'; });
    update();
  });
  update();
})();
