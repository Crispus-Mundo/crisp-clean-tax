/* Front-page engine: builds header, hero picker, fit quiz, steps, FAQ and the
   phone action bar from window.PAGE (set in each page). No tracking, no storage. */
(function () {
  var P = window.PAGE, B = window.BRAND;
  if (!P || !B) return;
  var app = document.getElementById('app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sms(body) { return 'sms:+1' + B.digits + '?&body=' + encodeURIComponent(body || B.textHello); }
  var ICON = {
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };
  var MARK = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="#C9A961" stroke-width="2.5"/>' +
    '<ellipse cx="20" cy="20" rx="7.5" ry="17" fill="none" stroke="#1B2951" stroke-width="2"/><path d="M3.5 20h33" stroke="#1B2951" stroke-width="2"/></svg>';

  var h = '';
  // header
  h += '<header class="top"><div class="wrap"><a class="mark" href="' + esc(B.home) + '">' + MARK + esc(B.name) + '</a>' +
    '<div class="top-actions"><a class="btn btn-ghost" href="' + sms(P.textBody) + '">Text ' + esc(B.phone) + '</a>' +
    '<a class="btn btn-solid" href="' + esc(P.book.url) + '">' + esc(P.book.label) + '</a></div></div></header>';

  // hero
  h += '<main><section class="hero"><div class="wrap"><h1>' + esc(P.title) +
    '<svg class="stroke" viewBox="0 0 520 18" preserveAspectRatio="none" aria-hidden="true"><path d="M4 12 C 120 2, 260 2, 516 9"/></svg></h1>' +
    '<p class="lead">' + esc(P.lead) + '</p>';
  if (P.picker) {
    h += '<div class="picker">' + P.picker.map(function (o) {
      return '<a class="pick" href="' + esc(o.url) + '"><i aria-hidden="true">' + (o.icon || '+') + '</i><b>' + esc(o.name) + '</b><span>' + esc(o.desc) + '</span></a>';
    }).join('') + '</div>';
  } else {
    h += '<div class="hero-ctas"><a class="btn btn-solid" href="' + esc(P.book.url) + '">' + esc(P.book.label) + '</a>' +
      '<a class="btn btn-ghost" href="#fit">Take the 30-second fit check</a></div>';
  }
  if (P.facts) h += '<ul class="facts">' + P.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
  h += '</div></section>';

  // quiz
  if (P.quiz) {
    h += '<section class="block" id="fit"><div class="wrap"><div class="quiz" id="quiz">' +
      '<h2>' + esc(P.quiz.title) + '</h2><p class="sub">' + esc(P.quiz.intro) + '</p>' +
      '<div class="q-count" id="qc"></div><div class="bar"><div id="qb"></div></div>' +
      '<div id="qbody"></div><div class="result" id="qres" aria-live="polite"></div></div></div></section>';
  }

  // steps
  if (P.steps) {
    h += '<section class="block alt"><div class="wrap"><h2>What happens next</h2><p class="sub">' + esc(P.stepsIntro || '') + '</p>' +
      '<ol class="steps">' + P.steps.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></li>'; }).join('') + '</ol></div></section>';
  }
  // faq
  if (P.faq) {
    h += '<section class="block"><div class="wrap"><h2>Questions families ask</h2><div class="faq">' +
      P.faq.map(function (f) { return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join('') + '</div></div></section>';
  }
  // other services
  if (P.more) {
    h += '<section class="block alt"><div class="wrap"><h2>Also from ' + esc(B.name) + '</h2><div class="more">' +
      P.more.map(function (m) { return '<a href="' + esc(m[1]) + '">' + esc(m[0]) + '</a>'; }).join('') + '</div></div></section>';
  }
  h += '</main><footer><div class="wrap"><span>' + esc(B.legal) + '</span><span>' + esc(B.area) + '</span></div></footer>';
  // phone dock
  h += '<nav class="dock" id="dock" aria-label="Contact"><a href="' + sms(P.textBody) + '">' + ICON.text + 'Text</a>' +
    '<a href="tel:+1' + B.digits + '">' + ICON.call + 'Call</a><a class="book" href="' + esc(P.book.url) + '">' + ICON.book + esc(P.book.short || 'Book') + '</a></nav>';
  app.innerHTML = h;

  // dock appears once they scroll past the hero
  var dock = document.getElementById('dock');
  function onScroll() { dock.classList.toggle('on', window.scrollY > 260); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- quiz engine ----------
  if (!P.quiz) return;
  var Q = P.quiz.questions, ans = [], i = 0;
  var qc = document.getElementById('qc'), qb = document.getElementById('qb'),
      body = document.getElementById('qbody'), res = document.getElementById('qres');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function render() {
    qc.textContent = 'Question ' + (i + 1) + ' of ' + Q.length;
    qb.style.width = (i / Q.length * 100) + '%';
    var q = Q[i];
    body.innerHTML = '<div class="q-text">' + esc(q.q) + '</div><div class="opts">' + q.o.map(function (o, k) {
      return '<button type="button" class="opt" data-k="' + k + '" aria-pressed="' + (ans[i] === k) + '">' + esc(o.t) + '</button>';
    }).join('') + '</div>' + (i > 0 ? '<div class="q-nav"><button type="button" class="q-back">Back</button></div>' : '');
    body.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () {
        ans[i] = +b.dataset.k;
        body.querySelectorAll('.opt').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        setTimeout(function () { i++; if (i < Q.length) render(); else finish(); }, reduce ? 0 : 220);
      });
    });
    var back = body.querySelector('.q-back');
    if (back) back.addEventListener('click', function () { i--; render(); });
    var first = body.querySelector('.opt'); if (first && i > 0) first.focus();
  }
  function finish() {
    qb.style.width = '100%'; qc.textContent = 'All done';
    var route = null, notes = [];
    Q.forEach(function (q, k) { var o = q.o[ans[k]]; if (o.r) route = o.r; if (o.n) notes.push(o.n); });
    var r = P.quiz.results[route || P.quiz.fallback];
    body.innerHTML = '';
    var text = 'Hi, I used your fit check. ' + r.name + '. ' + notes.join(' ');
    res.innerHTML = '<div class="q-count">Your best fit</div><div class="fit">' + esc(r.name) + '</div><p>' + esc(r.why) + '</p>' +
      '<div class="hero-ctas"><a class="btn btn-gold" href="' + esc(r.url) + '">' + esc(r.cta) + '</a>' +
      '<a class="btn btn-ghost" href="' + sms(text) + '">Text us instead</a></div>' +
      '<div class="q-nav"><button type="button" class="q-back" id="again">Start over</button></div>';
    res.classList.add('show');
    document.getElementById('again').addEventListener('click', function () { ans = []; i = 0; res.classList.remove('show'); res.innerHTML = ''; render(); });
    if (!reduce) burst();
    res.querySelector('.btn-gold').focus();
  }
  function burst() {
    var box = document.getElementById('quiz'), w = box.clientWidth;
    for (var n = 0; n < 26; n++) {
      var s = document.createElement('span'); s.className = 'spark';
      s.style.left = (w * .5) + 'px'; s.style.top = '60%';
      s.style.setProperty('--dx', (Math.random() * 2 - 1) * w * .45 + 'px');
      s.style.setProperty('--dy', -(80 + Math.random() * 220) + 'px');
      if (n % 3 === 0) s.style.background = '#FAF7F0';
      box.appendChild(s); setTimeout(function (el) { el.remove(); }, 1200, s);
    }
  }
  render();
})();
