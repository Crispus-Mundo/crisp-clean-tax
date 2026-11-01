// Crispus Mundo Tax Agent — side panel. The brain is in your Tax Platform (Google Apps Script, your account).
// This panel: signs in with your Tax Platform email + PIN, shows returns that passed Crispus Mundo review,
// reads the SuccessTax screen, asks the Tax Platform for the next step, does it, and repeats.
const DEFAULT_SERVER = 'https://script.google.com/macros/s/AKfycbwfNyYoPU947Zj2n_BJyEvXefdj6QkJjp_tIuVojSxoItl3wy5vI02M6Y7CBdvKgSJf/exec';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server = DEFAULT_SERVER, token = '', running = false, runId = '', tabId = null, returns = [];
const msg = s => { $('msg').textContent = s; };
const log = s => { $('log').textContent = (s + '\n' + $('log').textContent).slice(0, 9000); };

async function api(action, body = {}) {
  const r = await fetch(server, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action, token, ...body}), redirect: 'follow'});
  let j; try { j = await r.json(); } catch (_) { throw Error('The Tax Platform did not answer. Check the server address.'); }
  if (!j.ok) { if (/STAFF_SESSION_EXPIRED/.test(j.error || '')) signedOut(); throw Error(String(j.error || 'Error').replace('STAFF_SESSION_EXPIRED: ', '')); }
  return j;
}
function signedOut() { token = ''; chrome.storage.session.remove('token'); $('work').classList.add('hidden'); $('signin').classList.remove('hidden'); }

async function boot() {
  const s = await chrome.storage.local.get(['server', 'email']); const t = await chrome.storage.session.get(['token', 'who']);
  server = s.server || DEFAULT_SERVER; $('server').value = server; $('email').value = s.email || '';
  if (t.token) { token = t.token; showWork(t.who); loadReturns().catch(e => msg(e.message)); }
}
function showWork(who) { $('signin').classList.add('hidden'); $('work').classList.remove('hidden'); $('who').textContent = 'Signed in: ' + (who || ''); }

$('go').onclick = async () => {
  try {
    server = ($('server').value.trim() || DEFAULT_SERVER);
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(server)) throw Error('Server must be your Tax Platform (script.google.com) address.');
    const j = await api('signin', {email: $('email').value.trim(), pin: $('pin').value});
    token = j.token; $('pin').value = '';
    const who = `${j.user.name} (${j.user.tierLabel})`;
    await chrome.storage.local.set({server, email: $('email').value.trim()});
    await chrome.storage.session.set({token, who});           // session only: gone when Chrome closes
    showWork(who); await loadReturns();
  } catch (e) { msg(e.message); }
};
$('out').onclick = async () => { try { await api('signout'); } catch (_) {} signedOut(); msg('Signed out.'); };

async function loadReturns() {
  returns = (await api('returns')).returns;
  $('ret').innerHTML = returns.map(r => `<option value="${esc(r.returnId)}">${r.ready ? '✅' : '⛔'} ${esc(r.client)} ${esc(r.taxYear)} ${esc(r.returnType || '')}</option>`).join('') || '<option value="">No returns assigned to you</option>';
  await showReturn();
}
async function showReturn() {
  const id = $('ret').value; if (!id) { $('detail').innerHTML = ''; return; }
  const j = await api('load', {returnId: id});
  $('sd').value = j.schoolDistrict || ''; $('sdBox').classList.toggle('hidden', !j.ready);
  $('detail').innerHTML = j.ready
    ? `<p class="ok">Ready for SuccessTax — signed off in Crispus Mundo review.</p>` + j.documents.map(d => `<b>${esc(d.doc)}</b><ul>` +
        d.lines.map(l => `<li>${esc(l.label)}: ${esc(l.value)}</li>`).join('') + '</ul>').join('')
    : `<p class="bad">Not ready yet:</p><ul>${j.blockers.map(b => `<li>${esc(b)}</li>`).join('')}</ul><small>Finish these in the Tax Platform, then press ↻.</small>`;
  $('start').disabled = !j.ready;
}
$('ret').onchange = () => showReturn().catch(e => msg(e.message));
$('refresh').onclick = () => loadReturns().catch(e => msg(e.message));
$('sdSave').onclick = async () => { try { await api('school', {returnId: $('ret').value, district: $('sd').value}); msg('School district saved for this client.'); } catch (e) { msg(e.message); } };

async function sTab() {
  if (tabId) { try { const t = await chrome.tabs.get(tabId); if (/mytaxoffice\.com/.test(new URL(t.url).hostname)) return t; } catch (_) {} }
  const t = (await chrome.tabs.query({active: true, currentWindow: true}))[0];
  if (!t || !/(^|\.)mytaxoffice\.com$/.test(new URL(t.url || 'about:blank').hostname || '')) throw Error('Click on your SuccessTax tab (signed in, client return open), then press Start.');
  tabId = t.id; return t;
}
async function settle(id) { for (let i = 0; i < 40; i++) { const t = await chrome.tabs.get(id); if (t.status === 'complete') break; await sleep(250); } await sleep(400); }
async function observe(t) {
  try { await chrome.scripting.executeScript({target: {tabId: t.id, allFrames: true}, world: 'MAIN', func: mtaPageDialogs}); } catch (_) {}
  const res = await chrome.scripting.executeScript({target: {tabId: t.id, allFrames: true}, func: mtaPageObserve, args: [MTA_IDENTITY.source]});
  const top = res.find(r => r.frameId === 0)?.result || {url: t.url, title: t.title, text: ''};
  const elements = []; let text = top.text || '';
  for (const r of res) { if (!r.result) continue;
    r.result.elements.forEach(e => { const {n, ...rest} = e; elements.push({ref: r.frameId + ':' + n, ...rest}); });
    if (r.frameId !== 0 && r.result.text) text += '\n--- frame ---\n' + r.result.text; }
  const dialogs = [];
  try { (await chrome.scripting.executeScript({target: {tabId: t.id, allFrames: true}, world: 'MAIN', func: () => (window.__mtaDialogs || []).splice(0)}))
    .forEach(x => dialogs.push(...(x.result || []))); } catch (_) {}
  return {url: top.url, title: top.title, text: text.slice(0, 4000), elements, dialogs};
}

async function run() {
  if (running) return;
  const t = await sTab();
  runId = (await api('start', {returnId: $('ret').value})).runId;
  running = true; $('start').disabled = true; $('log').textContent = '';
  log('▶ Started. Watch the SuccessTax tab. Pause or STOP any time.');
  let last = '', refusals = 0;
  try {
    while (running) {
      await settle(t.id);
      const obs = await observe(t);
      if (obs.dialogs.length) last += '\nDialog(s) on the page: ' + obs.dialogs.join(' | ');
      const r = await api('step', {runId, observation: obs, lastResult: last}); last = '';
      if (r.preparerOnly?.length) $('left').innerHTML = '<b>Left for you to type (identity numbers):</b><ul>' + r.preparerOnly.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>';
      if (r.action === 'refused') { refusals++; last = 'Your last step was refused: ' + r.reason; log(`⛔ ${r.step}. ${r.did} — ${r.reason}`);
        if (refusals >= 5) { log('■ Stopped after 5 refused steps in a row. Check the screen.'); break; } continue; }
      refusals = 0;
      if (['click', 'check', 'type', 'select'].includes(r.action)) {
        const [fid, n] = r.ref.split(':');
        const done = (await chrome.scripting.executeScript({target: {tabId: t.id, frameIds: [Number(fid)]}, func: mtaPageAct,
          args: [r.action, n, r.value ?? '', MTA_BLOCKED.source, MTA_IDENTITY.source]}))[0].result;
        last = `${r.did}: ${done.note}`;
        log(`${done.ok ? '✓' : '⚠'} ${r.step}. ${r.did}${r.action === 'type' ? ' = ' + r.value : ''} — ${done.note}`);
        await sleep(r.action === 'click' ? 900 : 250);
      } else if (r.action === 'scroll') { await chrome.scripting.executeScript({target: {tabId: t.id, allFrames: true}, func: () => window.scrollBy(0, innerHeight * 0.8)}); last = 'scrolled'; }
      else if (r.action === 'wait') { await sleep(1500); last = 'waited'; }
      else if (r.action === 'mark_done') { last = r.doc + ' marked done'; log(`✅ ${r.step}. ${r.doc} entered and saved`); }
      else if (r.action === 'ask_preparer') { log('✋ The agent needs you: ' + r.message); msg('The agent needs you: ' + r.message); break; }
      else if (r.action === 'finished') { log('🏁 ' + r.message); msg('Ready for your review and e-file. The agent did not e-file, sign or pay anything.'); break; }
    }
  } catch (e) { log('■ ' + e.message); msg(e.message); }
  finally { running = false; $('start').disabled = false; }
}
$('start').onclick = () => run().catch(e => msg(e.message));
$('pause').onclick = async () => { running = false; if (runId) try { await api('pause', {runId}); } catch (_) {} log('⏸ Paused.'); };
$('stopAll').onclick = async () => { running = false; if (runId && token) try { await api('stop', {runId}); } catch (_) {} log('■ STOPPED.'); msg('Stopped.'); };
boot();
