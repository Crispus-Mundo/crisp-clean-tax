// Crispus Mundo Tax Agent — phone & computer app. Talks only to your Tax Platform (Apps Script, your Google account).
const SERVER = 'https://script.google.com/macros/s/AKfycbwfNyYoPU947Zj2n_BJyEvXefdj6QkJjp_tIuVojSxoItl3wy5vI02M6Y7CBdvKgSJf/exec';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
let token = sessionStorage.getItem('mta') || '', poll = null, openRun = '';
const msg = s => { $('msg').textContent = s; };

async function api(action, body = {}) {
  const r = await fetch(SERVER, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action, token, ...body})});
  const j = await r.json();
  if (!j.ok) { if (/STAFF_SESSION_EXPIRED/.test(j.error || '')) out(); throw Error(String(j.error).replace('STAFF_SESSION_EXPIRED: ', '')); }
  return j;
}
function out() { token = ''; sessionStorage.removeItem('mta'); clearInterval(poll); $('work').classList.add('hidden'); $('signin').classList.remove('hidden'); }
function show(who) { $('signin').classList.add('hidden'); $('work').classList.remove('hidden'); $('who').textContent = who || ''; }

$('go').onclick = async () => {
  try { const j = await api('signin', {email: $('email').value.trim(), pin: $('pin').value}); $('pin').value = '';
    token = j.token; sessionStorage.setItem('mta', token); sessionStorage.setItem('mtaWho', j.user.name);   // gone when the app closes
    show(j.user.name); await load(); } catch (e) { msg(e.message); }
};
$('out').onclick = async () => { try { await api('signout'); } catch (_) {} out(); };
$('refresh').onclick = () => load().catch(e => msg(e.message));

async function load() {
  const [r, rs] = await Promise.all([api('returns'), api('runs')]);
  $('rets').innerHTML = r.returns.map(x => `<div class="ret" data-r="${esc(x.returnId)}">${x.ready ? '<span class="ok">Ready</span>' : '<span class="bad">Not ready</span>'} · <b>${esc(x.client)}</b> ${esc(x.taxYear)} <span class="pill">${esc(x.returnType || '')}</span>` +
    (x.ready ? '' : `<br><small>${x.blockers.map(esc).join(' · ')}</small>`) + '</div>').join('') || '<p class="muted">No returns assigned to you.</p>';
  $('runs').innerHTML = rs.runs.map(x => `<div class="ret" data-run="${esc(x.runId)}"><b>${esc(x.client)}</b> <span class="pill">${esc(String(x.status).replace(/_/g, ' ').toLowerCase())}</span> <small>step ${x.steps} · ${esc(String(x.updatedAt).slice(0, 16).replace('T', ' '))}</small></div>`).join('') || 'No runs yet.';
  document.querySelectorAll('[data-r]').forEach(d => d.onclick = () => ret(d.dataset.r).catch(e => msg(e.message)));
  document.querySelectorAll('[data-run]').forEach(d => d.onclick = () => runView(d.dataset.run).catch(e => msg(e.message)));
}
async function ret(id) {
  const j = await api('load', {returnId: id});
  $('retDetail').innerHTML = `<div class="card"><h2>${esc(j.client)} ${esc(j.taxYear)}</h2>` + (j.ready
    ? '<p class="ok">Signed off in Crispus Mundo review — ready for SuccessTax.</p>' + j.documents.map(d => `<b>${esc(d.doc)}</b><ul>${d.lines.map(l => `<li>${esc(l.label)}: ${esc(l.value)}</li>`).join('')}</ul>`).join('') +
      `<small>Michigan school district</small><input id="sd" value="${esc(j.schoolDistrict)}" placeholder="e.g. 63290 Walled Lake"><button id="sdSave" class="ghost">Save district</button>`
    : '<p class="bad">Not ready yet:</p><ul>' + j.blockers.map(b => `<li>${esc(b)}</li>`).join('') + '</ul>') + '</div>';
  const b = $('sdSave'); if (b) b.onclick = async () => { await api('school', {returnId: id, district: $('sd').value}); msg('Saved.'); };
}
async function runView(id) {
  openRun = id; clearInterval(poll);
  const draw = async () => {
    const r = (await api('run', {runId: id})).run;
    $('runDetail').innerHTML = `<div class="card"><h2>${esc(r.client)} — ${esc(String(r.status).replace(/_/g, ' ').toLowerCase())}</h2><small>Step ${r.steps} of ${r.maxSteps} max · started by ${esc(r.startedBy)}</small>` +
      (r.note ? `<p>${esc(r.note)}</p>` : '') + `<pre>${r.transcript.slice().reverse().map(t => `${t.refused ? '⛔' : '✓'} ${t.n}. ${esc(t.did)}${t.refused ? ' — ' + esc(t.refused) : ''}`).join('\n')}</pre>` +
      (r.status === 'RUNNING' ? '<button id="p" class="ghost">⏸ Pause</button><button id="s" class="stop">■ Stop</button>' : '') + '</div>';
    if ($('p')) { $('p').onclick = () => api('pause', {runId: id}).then(draw); $('s').onclick = () => api('stop', {runId: id}).then(draw); }
    if (r.status !== 'RUNNING') clearInterval(poll);
  };
  await draw(); poll = setInterval(() => draw().catch(() => {}), 5000);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
let promptEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEvt = e;
  $('install').innerHTML = '<button id="inst">Install this app on this device</button>'; $('inst').onclick = () => promptEvt.prompt(); });
if (/iphone|ipad/i.test(navigator.userAgent)) $('install').textContent = 'iPhone/iPad: tap Share → Add to Home Screen to install this app.';
if (token) { show(sessionStorage.getItem('mtaWho')); load().catch(e => msg(e.message)); }
