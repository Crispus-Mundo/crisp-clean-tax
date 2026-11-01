// Functions that run INSIDE the SuccessTax page frames (self-contained). Same code that passed the Chrome tests.
const MTA_BLOCKED = /(e-?\s?file|transmit|submit\s*(the\s*)?return|send\s*to\s*(the\s*)?(irs|state)|\bsign(ature)?\b|\bpay(ment)?\b|purchase|\bbuy\b|checkout|\bdelete\b|\bremove\b|\berase\b|refund\s*transfer|bank\s*product|\bloan\b|log\s*-?\s*out|sign\s*-?\s*out|8879|authori[sz]e|\bprint\b|change\s*password|preparer\s*setup|office\s*setup)/i;
const MTA_IDENTITY = /(ssn|social.?sec.?num|\bein\b|_ein|ein_|fein|\btin\b|itin|routing|\brtn\b|acct|account|bank|\bpin\b|password|passwd|signature|efile|e_file)/i;

function mtaPageObserve(identitySrc) {
  const identity = new RegExp(identitySrc, 'i');
  const vis = e => { const r = e.getClientRects(); if (!r.length) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const labelOf = e => {
    const a = e.getAttribute('aria-label'); if (a) return a.trim();
    if (e.id) { const l = document.querySelector(`label[for="${CSS.escape(e.id)}"]`); if (l) return l.innerText.trim(); }
    if (/^(BUTTON|A)$/.test(e.tagName) || e.getAttribute('role') === 'button') return (e.innerText || e.title || e.value || '').trim();
    if (e.type === 'button' || e.type === 'submit') return (e.value || e.title || '').trim();
    const l = e.closest('label'); if (l) return l.innerText.trim();
    const td = e.closest('td'); const p = td?.previousElementSibling; if (p?.innerText?.trim()) return p.innerText.trim();
    const row = e.closest('tr'); if (row) return row.innerText.trim();
    return (e.title || e.placeholder || e.name || '').trim();
  };
  const sel = 'input,select,textarea,button,a[href],[role=button],[onclick],[role=tab],[role=menuitem]';
  const els = [...document.querySelectorAll(sel)].filter(e => vis(e) && !(e.tagName === 'INPUT' && e.type === 'hidden')).slice(0, 300);
  const out = els.map((e, i) => {
    e.setAttribute('data-mta-ref', String(i));
    const tag = e.tagName.toLowerCase(), o = {n: i, tag, type: (e.type || '').toLowerCase(), name: e.name || '', id: e.id || '', label: labelOf(e).replace(/\s+/g, ' ').slice(0, 100)};
    if (tag === 'a') o.href = (e.getAttribute('href') || '').slice(0, 120);
    if (/^(input|textarea|select)$/.test(tag)) {
      let v = e.type === 'checkbox' || e.type === 'radio' ? (e.checked ? 'checked' : 'unchecked') : String(e.value || '');
      if (identity.test(o.name + ' ' + o.id + ' ' + o.label) && v && !/checked/.test(v)) v = '[hidden]';
      o.value = v.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]').slice(0, 80);
      if (e.disabled || e.readOnly) o.locked = true;
    }
    if (tag === 'select') o.options = [...e.options].slice(0, 60).map(x => ({value: x.value, text: x.text.trim().slice(0, 60)}));
    return o;
  });
  const text = (document.body?.innerText || '').replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]').slice(0, 2500);
  return {url: location.href, title: document.title, text, elements: out};
}

function mtaPageDialogs() { // MAIN world: alert/confirm/prompt would freeze the agent; capture them for the preparer instead
  if (window.__mtaDialogHook) return; window.__mtaDialogHook = true; window.__mtaDialogs = [];
  const keep = (k, m) => window.__mtaDialogs.push(k + ': ' + String(m ?? '').slice(0, 300));
  window.alert = m => keep('alert', m);
  window.confirm = m => { keep('confirm (answered Cancel — preparer must decide)', m); return false; };
  window.prompt = m => { keep('prompt (left blank — preparer must decide)', m); return null; };
}

async function mtaPageAct(action, n, value, blockedSrc, identitySrc) {
  const blocked = new RegExp(blockedSrc, 'i'), identity = new RegExp(identitySrc, 'i');
  const e = document.querySelector(`[data-mta-ref="${n}"]`);
  if (!e) return {ok: false, note: 'element moved or disappeared — looking again'};
  const words = [e.innerText, e.value, e.title, e.getAttribute('aria-label'), e.name, e.id, e.getAttribute('href')].join(' ');
  e.scrollIntoView({block: 'center'});
  const flash = c => { e.style.outline = '3px solid ' + c; };
  if (action === 'click' || action === 'check') {
    if (blocked.test(words)) return {ok: false, note: 'refused in page: preparer-only control'};
    if (e.type === 'password' || e.type === 'file') return {ok: false, note: 'restricted element'};
    flash('#C9A961'); e.click(); return {ok: true, note: 'clicked'};
  }
  const setVal = v => { const proto = e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v); };
  if (action === 'select') {
    if (!(e instanceof HTMLSelectElement)) return {ok: false, note: 'not a list'};
    e.focus(); setVal(value); e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); e.blur();
    flash(e.value === value ? '#1e8e3e' : '#d93025'); return {ok: e.value === value, note: e.value === value ? 'chosen' : 'list did not take that choice'};
  }
  if (action === 'type') {
    if (!(e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) || /^(password|hidden|file|button|submit)$/i.test(e.type)) return {ok: false, note: 'not a typing box'};
    if (identity.test((e.name || '') + ' ' + (e.id || ''))) return {ok: false, note: 'refused in page: identity field'};
    if (e.disabled || e.readOnly) return {ok: false, note: 'box is locked'};
    flash('#f5b400'); e.focus(); e.dispatchEvent(new Event('focus'));
    setVal(''); for (const ch of String(value)) { setVal(e.value + ch); e.dispatchEvent(new Event('input', {bubbles: true}));
      e.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true, key: ch})); await new Promise(r => setTimeout(r, 30)); }
    e.dispatchEvent(new Event('change', {bubbles: true})); e.dispatchEvent(new Event('blur')); e.blur();
    await new Promise(r => setTimeout(r, 150));
    const norm = s => String(s).replace(/[$,\s]/g, '').replace(/\.0+$/, '').toUpperCase();
    const ok = norm(e.value) === norm(value);
    flash(ok ? '#1e8e3e' : '#d93025');
    return {ok, note: ok ? 'typed and checked' : 'SuccessTax changed it to "' + String(e.value).slice(0, 40) + '"'};
  }
  return {ok: false, note: 'unsupported'};
}
