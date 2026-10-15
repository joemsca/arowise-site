/* Small Arms Pistol Academy - scheduler.js
   The embedded class signup, in the SAPA skin. Mirrors the public flow of the AroWise class-scheduler
   (list grouped by class type -> class page with purchase option -> students / terms / review -> confirmation)
   using the demo data in schedule-data.js. Everything runs in the browser: nothing is saved past this tab and
   no email is sent. Routes live in the URL hash so the back button works:
     #register                      class list
     #register/c/CODE               class details and purchase option
     #register/c/CODE/register      the three-step registration
     #register/order/TOKEN          confirmation
   To wire this to the real backend, replace quote()/reserve() with calls to /api/public/<org>/quote and /register. */
(function () {
  'use strict';
  var root = document.getElementById('scheduler');
  var DATA = window.SAPA_SCHEDULE;
  if (!root || !DATA) return;
  var section = document.getElementById('register') || root;

  /* ---- helpers ---------------------------------------------------------------------------- */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(c) { var n = Math.abs(c) / 100; return (c < 0 ? '-' : '') + '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function time12(t) { var p = t.split(':'), h = Number(p[0]), m = p[1]; var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m + ' ' + ap; }
  function longDate(d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function sessionLabel(s) { return longDate(s.date) + ', ' + time12(s.start) + ' to ' + time12(s.end); }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---- demo persistence (this tab only) --------------------------------------------------- */
  function load(k, d) { try { return JSON.parse(sessionStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var seatsTaken = load('sapa-demo-seats', {});
  var orders = load('sapa-demo-orders', {});
  function available(c) { return Math.max(0, c.available - (seatsTaken[c.code] || 0)); }

  var classes = {};
  DATA.types.forEach(function (t) { t.classes.forEach(function (c) { classes[c.code] = c; }); });
  function typeOf(c) { return DATA.types.filter(function (t) { return t.id === c.typeId; })[0]; }

  /* ---- pricing (same rules as the class-scheduler engine, simplified: fee absorbed) -------- */
  function price(st) {
    var cls = classes[st.code], type = typeOf(cls), option = st.option;
    var lines = [];
    var classCents = option.price;
    lines.push({ key: 'class', label: option.name, cents: classCents, kind: 'charge' });
    var addonsCents = 0, taxCents = 0;
    type.addons.forEach(function (id) {
      var a = DATA.addons[id], q = st.addons[id] || 0;
      if (q > 0) { addonsCents += q * a.price; taxCents += q * a.tax; }
    });
    if (addonsCents) lines.push({ key: 'addons', label: 'Add-ons', cents: addonsCents, kind: 'charge' });
    if (taxCents) lines.push({ key: 'tax', label: 'Sales tax', cents: taxCents, kind: 'charge' });
    var discountCents = 0;
    if (st.discount) {
      discountCents = st.discount.type === 'percent' ? Math.round(classCents * st.discount.value / 100) : Math.min(st.discount.value, classCents + addonsCents);
      lines.push({ key: 'discount', label: 'Discount (' + st.discount.code + ')', cents: -discountCents, kind: 'credit' });
    }
    var total = classCents + addonsCents + taxCents - discountCents;
    lines.push({ key: 'total', label: 'Total', cents: total, kind: 'total' });
    var dueNow = total;
    if (st.deposit && option.deposit !== null) {
      dueNow = Math.min(option.deposit, total);
      lines.push({ key: 'due-now', label: 'Due today (deposit)', cents: dueNow, kind: 'info' });
      lines.push({ key: 'balance', label: 'Balance due at class', cents: total - dueNow, kind: 'info' });
    }
    return { lines: lines, total: total, dueNow: dueNow };
  }

  /* ---- routing ---------------------------------------------------------------------------- */
  function route() {
    var h = location.hash.replace(/^#/, '');
    if (!/^register(\/|$)/.test(h)) return { view: 'list' };
    var p = h.split('/');
    if (p[1] === 'c' && p[2] && p[3] === 'register') return { view: 'wizard', code: p[2] };
    if (p[1] === 'c' && p[2]) return { view: 'detail', code: p[2] };
    if (p[1] === 'order' && p[2]) return { view: 'order', token: p[2] };
    return { view: 'list' };
  }
  function go(hash) { location.hash = hash; }

  var wiz = null; // in-progress registration state

  function render() {
    var r = route();
    if (r.view === 'detail' && classes[r.code]) renderDetail(classes[r.code]);
    else if (r.view === 'wizard' && classes[r.code]) renderWizard(classes[r.code]);
    else if (r.view === 'order' && orders[r.token]) renderOrder(orders[r.token]);
    else renderList();
    if (r.view !== 'list' || location.hash === '#register') { /* keep the widget in view on every step */
      if (r.view !== 'list') section.scrollIntoView({ block: 'start' });
    }
  }
  window.addEventListener('hashchange', render);

  /* ---- views ------------------------------------------------------------------------------ */
  function renderList() {
    var html = '<p class="sch-intro">Pick a class to see details and register.</p>';
    DATA.types.forEach(function (t) {
      html += '<section class="sch-group" data-testid="class-group" data-type="' + t.id + '"><h3 class="heading-1">' + esc(t.name) + '</h3>';
      if (!t.classes.length) {
        html += '<div class="sch-card"><p>There are currently no classes of this type available. Please check back often or sign up below to receive schedule notifications via email.</p>' +
          '<form class="sch-notify" data-testid="notify-form" data-type="' + t.id + '">' +
          '<div class="sch-field"><label for="nf-' + t.id + '">First name</label><input class="sch-input" id="nf-' + t.id + '" name="firstName" required maxlength="80"></div>' +
          '<div class="sch-field"><label for="ne-' + t.id + '">Email</label><input class="sch-input" id="ne-' + t.id + '" name="email" type="email" required maxlength="200"></div>' +
          '<button class="sapa-btn sapa-btn-secondary" type="submit" data-testid="notify-submit">Notify me</button></form></div>';
      }
      t.classes.forEach(function (c) {
        var av = available(c), sold = av <= 0, s0 = c.sessions[0].date;
        html += '<article class="sch-card sch-class" data-testid="class-card" data-code="' + c.code + '" data-available="' + av + '">' +
          '<div class="sch-date' + (sold ? ' is-soldout' : '') + '"><span class="m">' + MONTHS[s0.getMonth()] + '</span><span class="d">' + String(s0.getDate()).padStart(2, '0') + '</span><span class="y">' + s0.getFullYear() + '</span></div>' +
          '<div><h4>' + esc(c.name) + '</h4>' + (t.subtitle && t.subtitle !== c.name ? '<p class="sub">' + esc(t.subtitle) + '</p>' : '') + '</div>' +
          '<dl class="sch-dl"><dt>Seats available</dt> <dd class="num' + (sold ? ' is-zero' : '') + '">' + av + '</dd> <dt>Class size</dt> <dd class="num">' + c.capacity + '</dd> <dt>Instructors</dt> <dd>' + esc(t.instructors.join(', ')) + '</dd> <dt>Location</dt> <dd>' + esc(t.location.name) + '<span class="sapa-muted">, ' + esc(t.location.address) + '</span></dd></dl>' +
          '<div class="sch-foot"><span class="sapa-tag sapa-tag-quiet" data-testid="duration">' + c.days + ' day class</span>' +
          (sold ? '<span class="sapa-tag sapa-tag-dark sapa-plaque sapa-plaque-sm" data-testid="sold-out">Sold out</span>' : '<a class="sapa-btn sapa-btn-primary" href="#register/c/' + c.code + '" data-testid="select">Select</a>') +
          '</div></article>';
      });
      html += '</section>';
    });
    root.innerHTML = html;
  }

  function renderDetail(c) {
    var t = typeOf(c), av = available(c);
    var opts = t.options.map(function (o) {
      var fits = o.seats <= av;
      var dep = o.deposit !== null ? ' (' + money(o.deposit) + ' deposit or full payment due today)' : '';
      return '<option value="' + o.id + '"' + (fits ? '' : ' disabled') + '>' + esc(o.name) + ' - ' + money(o.price) + dep + (fits ? '' : ' (not enough seats left)') + '</option>';
    }).join('');
    var sessions = c.sessions.map(function (s) { return '<li><b>' + longDate(s.date) + '</b>, ' + time12(s.start) + ' to ' + time12(s.end) + '</li>'; }).join('');
    root.innerHTML =
      '<div data-testid="class-detail">' +
      '<div class="sch-head"><p class="sch-steps">Class details</p><h3>' + esc(c.name) + '</h3>' + (t.subtitle !== c.name ? '<p class="sub">' + esc(t.subtitle) + '</p>' : '') +
      '<div class="sch-tags"><span class="sapa-tag sapa-tag-quiet">' + c.days + ' day class</span>' + (av > 0 ? '<span class="sapa-tag sapa-plaque sapa-plaque-sm">' + av + ' of ' + c.capacity + ' seats available</span>' : '<span class="sapa-tag sapa-tag-dark sapa-plaque sapa-plaque-sm">Sold out</span>') + '</div></div>' +
      '<div class="sch-card"><p>' + esc(t.description) + '</p></div>' +
      '<div class="sch-card"><h4>Schedule</h4><ul class="sch-sessions">' + sessions + '</ul>' +
      '<div class="sch-grid" style="margin-top:16px"><div><h5>Class location</h5><p><b>' + esc(t.location.name) + '</b><br>' + esc(t.location.address) + '</p><p class="sch-help">' + esc(t.location.note) + '</p></div>' +
      '<div><h5>Instructors</h5><p>' + esc(t.instructors.join(', ')) + '</p><h5 style="margin-top:12px">Questions</h5><p><a class="text-link" href="sms:' + DATA.org.phoneDigits + '">Text ' + DATA.org.phone + '</a></p></div></div></div>' +
      '<div class="sch-card" data-testid="purchase"><h4>Discounts &amp; Purchase Options</h4>' +
      (av <= 0 ? '<p class="sapa-muted" data-testid="sold-out">This class is sold out. Text ' + DATA.org.phone + ' to be added to the waitlist.</p><div class="sch-actions"><a class="sapa-btn sapa-btn-secondary" href="#register">Back to all classes</a></div>' :
        '<form id="sch-option-form"><div class="sch-field"><label for="option">Purchase option</label><select class="sch-select" id="option" name="option">' + opts + '</select><p class="sch-help">Discount and gift certificate codes are entered on the review step.</p></div>' +
        '<label class="sch-check-row"><input class="sch-check" type="checkbox" name="deposit" value="1"><span>Pay deposit now and balance at class <span class="sapa-muted">(not available for all options)</span></span></label>' +
        '<div class="sch-actions"><a class="sapa-btn sapa-btn-link" href="#register">Back</a><button class="sapa-btn sapa-btn-primary" type="submit" data-testid="next">Next</button></div></form>') +
      '</div></div>';
    var form = root.querySelector('#sch-option-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var oid = form.querySelector('#option').value;
      var option = t.options.filter(function (o) { return o.id === oid; })[0];
      wiz = { code: c.code, option: option, deposit: form.querySelector('[name=deposit]').checked, step: 'students', students: [], purchaser: { first: '', last: '', email: '', phone: '' }, same: false, addons: {}, termsAccepted: false, discount: null, codeMsg: null };
      resize(wiz);
      go('#register/c/' + c.code + '/register');
    });
  }

  function resize(st) {
    var n = st.option.seats; st.students = st.students.slice(0, n);
    while (st.students.length < n) st.students.push({ first: '', last: '', legal: '', email: '', phone: '' });
  }

  function renderWizard(c) {
    var t = typeOf(c);
    if (!wiz || wiz.code !== c.code) { wiz = null; go('#register/c/' + c.code); return; }
    var steps = t.terms ? ['students', 'terms', 'review'] : ['students', 'review'];
    var idx = steps.indexOf(wiz.step);
    var titles = { students: 'Students', terms: 'Terms', review: 'Review and reserve' };
    var head = '<div class="sch-head"><p class="sch-steps">Step ' + (idx + 1) + ' of ' + steps.length + ': ' + titles[wiz.step] + '</p><h3>' + esc(c.name) + '</h3><p class="sub">' + esc(sessionLabel(c.sessions[0])) + (c.sessions.length > 1 ? ' and ' + (c.sessions.length - 1) + ' more day' + (c.sessions.length > 2 ? 's' : '') : '') + '</p></div>';
    var body = '';
    if (wiz.step === 'students') body = studentsStep(c, t);
    else if (wiz.step === 'terms') body = termsStep();
    else body = reviewStep(c, t);
    root.innerHTML = '<div data-testid="wizard" data-step="' + wiz.step + '">' + head + (wiz.error ? '<div class="sch-alert" role="alert">' + esc(wiz.error) + '</div>' : '') + body + '</div>';
    wiz.error = null;
    bindWizard(c, t, steps, idx);
  }

  function studentsStep(c, t) {
    var av = available(c), st = wiz;
    var opts = t.options.map(function (o) { return '<option value="' + o.id + '"' + (o.id === st.option.id ? ' selected' : '') + (o.seats > av ? ' disabled' : '') + '>' + esc(o.name) + ' - ' + money(o.price) + (o.seats > av ? ' (not enough seats left)' : '') + '</option>'; }).join('');
    var h = '<div class="sch-card"><div class="sch-field"><label for="option">Purchase option</label><select class="sch-select" id="option">' + opts + '</select><p class="sch-help">' + st.option.seats + (st.option.seats === 1 ? ' seat. ' : ' seats. ') + av + (av === 1 ? ' seat' : ' seats') + ' still available in this class.</p></div></div>';
    st.students.forEach(function (s, i) {
      h += '<div class="sch-card" data-testid="student-' + (i + 1) + '"><h4>Student ' + (i + 1) + '</h4><div class="sch-grid">' +
        field('s' + i + '-first', 'First name', s.first, { auto: i === 0 ? 'given-name' : 'off', required: true }) +
        field('s' + i + '-last', 'Last name', s.last, { auto: i === 0 ? 'family-name' : 'off', required: true }) +
        '<div class="full">' + field('s' + i + '-legal', 'Legal name', s.legal, { placeholder: 'As it should appear on the certificate', help: 'Leave blank to use first and last name.' }) + '</div>' +
        field('s' + i + '-email', 'Email', s.email, { type: 'email', auto: i === 0 ? 'email' : 'off' }) +
        field('s' + i + '-phone', 'Phone', s.phone, { type: 'tel', auto: i === 0 ? 'tel' : 'off' }) +
        '</div></div>';
    });
    var p = st.same ? st.students[0] : st.purchaser;
    h += '<div class="sch-card" data-testid="purchaser"><div class="sch-row"><div><h4 style="margin:0">Purchaser</h4><p class="sch-help">Who is paying and should receive the receipt.</p></div>' +
      '<label class="sch-check-row"><input class="sch-check" type="checkbox" id="same-as-student"' + (st.same ? ' checked' : '') + '><span>Same as student 1</span></label></div><div class="sch-grid">' +
      field('p-first', 'First name', p.first, { auto: 'given-name', required: true, ro: st.same }) + field('p-last', 'Last name', p.last, { auto: 'family-name', required: true, ro: st.same }) +
      field('p-email', 'Email', p.email, { type: 'email', auto: 'email', required: true, ro: st.same }) + field('p-phone', 'Phone', p.phone, { type: 'tel', auto: 'tel', ro: st.same }) + '</div></div>';
    if (t.addons.length) {
      h += '<div class="sch-card" data-testid="addons"><h4>Add-ons</h4><p class="sch-help">Optional extras, charged per item.</p>';
      t.addons.forEach(function (id) {
        var a = DATA.addons[id], q = st.addons[id] || 0, o = '';
        for (var n = 0; n <= 5; n++) o += '<option value="' + n + '"' + (n === q ? ' selected' : '') + '>' + n + '</option>';
        h += '<div class="sch-addon"><label for="addon-' + id + '"><b>' + esc(a.name) + '</b><span class="price">' + money(a.price) + (a.tax ? ' + tax' : '') + '</span><span class="sch-help">' + esc(a.description) + '</span></label><select class="sch-select" id="addon-' + id + '" data-addon="' + id + '" aria-label="Quantity of ' + esc(a.name) + '">' + o + '</select></div>';
      });
      h += '</div>';
    }
    h += '<div class="sch-actions"><a class="sapa-btn sapa-btn-link" href="#register/c/' + c.code + '">Back to the class</a><button class="sapa-btn sapa-btn-primary" type="button" data-testid="next">Next</button></div>';
    return h;
  }

  function field(id, label, value, o) {
    o = o || {};
    return '<div class="sch-field' + (o.full ? ' full' : '') + '"><label for="' + id + '">' + label + '</label><input class="sch-input" id="' + id + '" type="' + (o.type || 'text') + '" value="' + esc(value) + '"' + (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.required ? ' required' : '') + (o.ro ? ' readonly' : '') + ' maxlength="160">' + (o.help ? '<p class="sch-help">' + o.help + '</p>' : '') + '</div>';
  }

  function termsStep() {
    return '<div class="sch-card"><h4>' + esc(DATA.terms.title) + '</h4><div class="sch-terms">' + esc(DATA.terms.body) + '</div>' +
      '<label class="sch-check-row"><input class="sch-check" type="checkbox" id="terms-accept"' + (wiz.termsAccepted ? ' checked' : '') + '><span>I have read and agree to the terms above.</span></label></div>' +
      '<div class="sch-actions"><button class="sapa-btn sapa-btn-link" type="button" data-testid="back">Back</button><button class="sapa-btn sapa-btn-primary" type="button" data-testid="next">Next</button></div>';
  }

  function reviewStep(c, t) {
    var q = price(wiz);
    var rows = q.lines.map(function (l) { return '<tr class="is-' + l.kind + '" data-line="' + l.key + '"><td>' + esc(l.label) + '</td><td>' + money(l.cents) + '</td></tr>'; }).join('');
    var students = wiz.students.map(function (s, i) { return '<li><span class="seat">Seat ' + (i + 1) + '</span><span><b>' + esc(s.legal || (s.first + ' ' + s.last)) + '</b>' + (s.email ? '<span class="sapa-muted"> · ' + esc(s.email) + '</span>' : '') + '</span></li>'; }).join('');
    var p = wiz.same ? wiz.students[0] : wiz.purchaser;
    return '<div class="sch-card"><h4>Students</h4><ul class="sch-students">' + students + '</ul><p class="sch-help" style="margin-top:12px">Purchased by ' + esc(p.first + ' ' + p.last) + ' (' + esc(p.email) + ') · ' + esc(wiz.option.name) + '</p></div>' +
      '<div class="sch-card"><h4>Discount or gift certificate code</h4><div class="sch-code"><div class="sch-field"><label for="discount-code">Code</label><input class="sch-input" id="discount-code" value="' + esc(wiz.discount ? wiz.discount.code : '') + '" autocomplete="off"></div><button class="sapa-btn sapa-btn-secondary" type="button" data-testid="apply-code">Apply</button></div>' +
      (wiz.codeMsg ? (wiz.codeMsg.ok ? '<p class="sch-code-ok" data-testid="code-ok">' + esc(wiz.codeMsg.text) + '</p>' : '<p class="sch-code-error" data-testid="code-error" role="alert">' + esc(wiz.codeMsg.text) + '</p>') : '') + '</div>' +
      '<div class="sch-card"><h4>Totals</h4><table class="sch-totals" data-testid="totals"><tbody>' + rows + '</tbody></table>' +
      (wiz.option.deposit !== null ? '<label class="sch-check-row" style="margin-top:16px"><input class="sch-check" type="checkbox" id="pay-deposit"' + (wiz.deposit ? ' checked' : '') + '><span>Pay the ' + money(wiz.option.deposit) + ' deposit today and the balance at class</span></label>' : '') +
      '<p class="sch-notice" style="margin-top:16px" data-testid="offline-instructions">' + esc(DATA.payments.offlineInstructions) + '</p></div>' +
      '<div class="sch-actions"><button class="sapa-btn sapa-btn-link" type="button" data-testid="back">Back</button><button class="sapa-btn sapa-btn-primary sapa-btn-lg" type="button" data-testid="reserve">Reserve ' + (wiz.option.seats === 1 ? 'my seat' : wiz.option.seats + ' seats') + '</button></div>';
  }

  function collectStudents() {
    wiz.students.forEach(function (s, i) {
      s.first = val('s' + i + '-first'); s.last = val('s' + i + '-last'); s.legal = val('s' + i + '-legal'); s.email = val('s' + i + '-email'); s.phone = val('s' + i + '-phone');
    });
    if (!wiz.same) wiz.purchaser = { first: val('p-first'), last: val('p-last'), email: val('p-email'), phone: val('p-phone') };
    root.querySelectorAll('[data-addon]').forEach(function (sel) { wiz.addons[sel.getAttribute('data-addon')] = Number(sel.value); });
  }
  function val(id) { var el = root.querySelector('#' + id); return el ? el.value.trim() : ''; }

  function validateStudents() {
    for (var i = 0; i < wiz.students.length; i++) {
      var s = wiz.students[i];
      if (!s.first) return 'Student ' + (i + 1) + ': first name is required';
      if (!s.last) return 'Student ' + (i + 1) + ': last name is required';
      if (s.email && !EMAIL.test(s.email)) return 'Student ' + (i + 1) + ': that email address does not look right';
    }
    var p = wiz.same ? wiz.students[0] : wiz.purchaser;
    if (!p.first) return 'Purchaser: first name is required';
    if (!p.last) return 'Purchaser: last name is required';
    if (!p.email || !EMAIL.test(p.email)) return 'Purchaser: a valid email address is required for the receipt';
    return null;
  }

  function bindWizard(c, t, steps, idx) {
    var next = root.querySelector('[data-testid="next"]');
    var back = root.querySelector('[data-testid="back"]');
    if (wiz.step === 'students') {
      root.querySelector('#option').addEventListener('change', function (e) {
        collectStudents();
        wiz.option = t.options.filter(function (o) { return o.id === e.target.value; })[0];
        resize(wiz); renderWizard(c);
      });
      var same = root.querySelector('#same-as-student');
      same.addEventListener('change', function () {
        collectStudents(); wiz.same = same.checked; renderWizard(c);
      });
      if (wiz.same) { // keep the purchaser mirror live while typing in student 1
        ['first', 'last', 'email', 'phone'].forEach(function (k) {
          var src = root.querySelector('#s0-' + k), dst = root.querySelector('#p-' + k);
          if (src && dst) src.addEventListener('input', function () { dst.value = src.value; });
        });
      }
      next.addEventListener('click', function () {
        collectStudents();
        var err = validateStudents();
        if (err) { wiz.error = err; renderWizard(c); return; }
        wiz.step = steps[idx + 1]; renderWizard(c);
      });
    } else if (wiz.step === 'terms') {
      next.addEventListener('click', function () {
        wiz.termsAccepted = root.querySelector('#terms-accept').checked;
        if (!wiz.termsAccepted) { wiz.error = 'Please confirm that you have read and agree to the terms.'; renderWizard(c); return; }
        wiz.step = 'review'; renderWizard(c);
      });
      back.addEventListener('click', function () { wiz.termsAccepted = root.querySelector('#terms-accept').checked; wiz.step = 'students'; renderWizard(c); });
    } else {
      root.querySelector('[data-testid="apply-code"]').addEventListener('click', function () {
        var code = root.querySelector('#discount-code').value.trim().toUpperCase();
        if (!code) { wiz.discount = null; wiz.codeMsg = null; renderWizard(c); return; }
        var d = DATA.discounts.filter(function (x) { return x.code === code && (!x.typeId || x.typeId === t.id); })[0];
        if (d) { wiz.discount = d; wiz.codeMsg = { ok: true, text: d.name + ' applied.' }; }
        else { wiz.discount = null; wiz.codeMsg = { ok: false, text: 'That code is not valid for this class.' }; }
        renderWizard(c);
      });
      var dep = root.querySelector('#pay-deposit');
      if (dep) dep.addEventListener('change', function () { wiz.deposit = dep.checked; renderWizard(c); });
      back.addEventListener('click', function () { wiz.step = steps[idx - 1]; renderWizard(c); });
      root.querySelector('[data-testid="reserve"]').addEventListener('click', function () { reserve(c, t); });
    }
  }

  function reserve(c, t) {
    if (available(c) < wiz.option.seats) { wiz.error = 'Sorry, only ' + available(c) + ' seats are left in this class.'; renderWizard(c); return; }
    var q = price(wiz);
    var counter = load('sapa-demo-invoice', 240) + 1; save('sapa-demo-invoice', counter);
    var token = Math.random().toString(36).slice(2, 10);
    var p = wiz.same ? wiz.students[0] : wiz.purchaser;
    var order = {
      token: token, code: c.code, invoice: 'SAPA-' + new Date().getFullYear() + '-' + String(counter).padStart(4, '0'),
      option: wiz.option, deposit: wiz.deposit && wiz.option.deposit !== null, lines: q.lines, total: q.total, dueNow: q.dueNow,
      students: wiz.students, purchaser: { first: p.first, last: p.last, email: p.email }, status: 'pending', created: new Date().toISOString()
    };
    seatsTaken[c.code] = (seatsTaken[c.code] || 0) + wiz.option.seats; save('sapa-demo-seats', seatsTaken);
    orders[token] = order; save('sapa-demo-orders', orders);
    wiz = null;
    go('#register/order/' + token);
  }

  function renderOrder(o) {
    var c = classes[o.code], t = typeOf(c);
    var rows = o.lines.map(function (l) { return '<tr class="is-' + l.kind + '" data-line="' + l.key + '"><td>' + esc(l.label) + '</td><td>' + money(l.cents) + '</td></tr>'; }).join('');
    var students = o.students.map(function (s, i) { return '<li><span class="seat">Seat ' + (i + 1) + '</span><span><b>' + esc(s.legal || (s.first + ' ' + s.last)) + '</b>' + (s.email ? '<span class="sapa-muted"> · ' + esc(s.email) + '</span>' : '') + '</span></li>'; }).join('');
    var sessions = c.sessions.map(function (s) { return '<li><b>' + longDate(s.date) + '</b>, ' + time12(s.start) + ' to ' + time12(s.end) + '</li>'; }).join('');
    var share = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(DATA.org.site + '/class-descriptions');
    root.innerHTML = '<div data-testid="confirmation">' +
      '<div class="sch-head"><p class="sch-steps">Registration confirmed</p><h3>You’re registered</h3><p class="sub">Invoice <b data-testid="invoice-number">' + o.invoice + '</b> · <span class="sapa-tag sapa-tag-quiet" data-testid="payment-status">' + (o.deposit ? 'Deposit due' : 'Payment pending') + '</span></p></div>' +
      '<div class="sch-demo" data-testid="demo-notice"><b>Preview only.</b> This is a demo of the signup flow: nothing was saved and no email was sent. On the live site you would receive a receipt and a welcome email, and Mike would see you on his roster.</div>' +
      '<div class="sch-card"><h4>' + esc(c.name) + '</h4><ul class="sch-sessions">' + sessions + '</ul><p style="margin-top:12px"><b>' + esc(t.location.name) + '</b><br>' + esc(t.location.address) + '</p></div>' +
      '<div class="sch-card" data-testid="students"><h4>Students</h4><ul class="sch-students">' + students + '</ul><p class="sch-help" style="margin-top:12px">Purchased by ' + esc(o.purchaser.first + ' ' + o.purchaser.last) + ' (' + esc(o.purchaser.email) + ') · ' + esc(o.option.name) + '</p></div>' +
      '<div class="sch-card"><h4>Totals</h4><table class="sch-totals" data-testid="totals"><tbody>' + rows + '</tbody></table><p class="sch-notice" style="margin-top:16px" data-testid="offline-instructions">' + esc(DATA.payments.offlineInstructions) + '</p></div>' +
      '<div class="sch-actions"><a class="sapa-btn sapa-btn-link" href="#register" data-testid="back-to-classes">Back to all classes</a><a class="sapa-btn sapa-btn-secondary" href="' + share + '" target="_blank" rel="noopener" data-testid="share-facebook">Share on Facebook</a></div></div>';
  }

  /* ---- notify form + class-card deep links ------------------------------------------------ */
  root.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-testid="notify-form"]');
    if (!f) return;
    e.preventDefault();
    var first = f.querySelector('[name=firstName]').value.trim(), email = f.querySelector('[name=email]').value.trim();
    if (!first || !EMAIL.test(email)) { f.querySelector('[name=email]').focus(); return; }
    f.outerHTML = '<p class="sch-notice" data-testid="notify-done">Thanks, ' + esc(first) + '. We’ll email ' + esc(email) + ' when the next class is scheduled. (Preview: nothing was saved.)</p>';
  });
  document.querySelectorAll('a[data-class]').forEach(function (a) {
    a.addEventListener('click', function () {
      var id = a.getAttribute('data-class');
      setTimeout(function () { var g = root.querySelector('[data-type="' + id + '"]'); if (g) g.scrollIntoView({ block: 'start' }); }, 50);
    });
  });

  render();
})();
