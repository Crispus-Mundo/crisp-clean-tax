// Test harness: runs MundoTaxAgent.gs against stand-ins for the Tax Platform's own functions and Google services.
// Run: node agent/server/test_server.js
const {world} = require('./harness');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (c ? '' : '  >> ' + JSON.stringify(x).slice(0, 300)));
const el = (ref, label, extra = {}) => ({ref, tag: 'input', type: 'text', label, name: '', value: '', ...extra});
const page = (...els) => ({url: 'https://www.mytaxoffice.com/main/pro/w2.php', title: 'SuccessTax', text: 'W2 SSN 123-45-6789 employer 38-1234567', elements: els});

// sign-in
let w = world();
check('ping', w.call({action: 'ping'}).ok);
check('wrong PIN refused', !w.call({action: 'signin', email: 'a', pin: '0000'}).ok);
const s = w.call({action: 'signin', email: 'cyars@x', pin: '2468'});
check('sign in with Tax Platform PIN', s.ok && s.token === 'TOK-EMP');
check('no session -> refused', /STAFF_SESSION_EXPIRED/.test(w.call({action: 'returns', token: 'bad'}).error));
// returns list + gates + scope
const rs = w.call({action: 'returns', token: 'TOK-EMP'}).returns;
check('only in-scope clients listed', rs.length === 2 && !rs.some(r => r.client.includes('Other')), rs);
check('signed-off return ready', rs.find(r => r.returnId === 'R1').ready);
check('not signed off -> blocked with plain reason', rs.find(r => r.returnId === 'R2').blockers.some(b => /signed off/.test(b)), rs);
check('out-of-scope return refused', /not assigned/.test(w.call({action: 'load', token: 'TOK-EMP', returnId: 'R3'}).error));
const ld = w.call({action: 'load', token: 'TOK-EMP', returnId: 'R1'});
check('approved lines grouped by document', ld.documents.length === 2 && ld.documents[0].lines.length === 3, ld);
check('unapproved line excluded', !JSON.stringify(ld).includes('777'));
check('EIN line left for preparer', JSON.stringify(ld).includes('(you enter this)') && !JSON.stringify(ld).includes('4567'));
check('intern cannot run', /Interns/.test(w.call({action: 'start', token: 'TOK-INT', returnId: 'R1'}).error));
check('cannot start unready return', /Not ready/.test(w.call({action: 'start', token: 'TOK-EMP', returnId: 'R2'}).error));
check('school district saved', w.call({action: 'school', token: 'TOK-EMP', returnId: 'R1', district: '63290 Walled Lake'}).district === '63290 Walled Lake');

// the agent steps
const P = page(el('0:1', 'Wages, tips', {name: 'wages_tips'}), el('0:2', 'Employer EIN', {name: 'employer_ein'}),
  {ref: '0:3', tag: 'button', type: 'button', label: 'Save'}, {ref: '0:4', tag: 'button', type: 'button', label: 'E-File Return'},
  {ref: '0:5', tag: 'a', label: 'Delete this W2'}, {ref: '0:6', tag: 'select', name: 'state1', label: 'State', options: [{value: 'MI', text: 'MI'}, {value: 'OH', text: 'OH'}]},
  {ref: '0:7', tag: 'select', name: 'school_district', label: 'School district', options: [{value: '63290', text: '63290 Walled Lake'}, {value: '63010', text: '63010 Birmingham'}]},
  {ref: '0:8', tag: 'a', label: 'W2'});
w = world({replies: [
  {action: 'type', ref: '0:1', value: '52341.12'}, {action: 'type', ref: '0:1', value: '99999'}, {action: 'type', ref: '0:1', value: '777'},
  {action: 'click', ref: '0:4'}, {action: 'click', ref: '0:5'}, {action: 'type', ref: '0:2', value: '38-1234567'},
  {action: 'select', ref: '0:6', value: 'OH'}, {action: 'select', ref: '0:7', value: '63290'}, {action: 'click', ref: '0:3'},
  {action: 'click', ref: '0:8'}, {action: 'mark_done', doc: 'W-2 · 111111'}, {action: 'mark_done', doc: 'made up'}, {action: 'click', ref: '9:9'},
  'not json at all', {action: 'finished', message: 'All entered'}]});
w.call({action: 'school', token: 'TOK-EMP', returnId: 'R1', district: '63290'});
const run = w.call({action: 'start', token: 'TOK-EMP', returnId: 'R1'}).runId;
const st = () => w.call({action: 'step', token: 'TOK-EMP', runId: run, observation: P, lastResult: ''});
const o = Array.from({length: 13}, st);
check('approved value typed', o[0].action === 'type' && o[0].value === '52341.12', o[0]);
check('invented number refused', o[1].action === 'refused' && /invented/.test(o[1].reason));
check('unapproved line value refused', o[2].action === 'refused');
check('e-file refused', o[3].action === 'refused' && /preparer-only/.test(o[3].reason));
check('delete refused', o[4].action === 'refused');
check('EIN refused (left for preparer)', o[5].action === 'refused' && /preparer/.test(o[5].reason));
check('state not on return refused', o[6].action === 'refused');
check('school district from preparer allowed', o[7].action === 'select' && o[7].value === '63290', o[7]);
check('Save allowed', o[8].action === 'click');
check('form navigation allowed', o[9].action === 'click');
check('mark document done', o[10].action === 'mark_done');
check('made-up document refused', o[11].action === 'refused');
check('element not on page refused', o[12].action === 'refused');
const bad = st();
check('unreadable AI reply -> asks preparer', bad.action === 'ask_preparer' && bad.status === 'NEEDS_PREPARER', bad);
check('paused run cannot step', /needs_preparer/.test(st().error || ''));
check('preparer-only list returned', o[0].preparerOnly.some(x => /EIN/.test(x)), o[0].preparerOnly);
check('identity numbers never sent to AI', w.claudeCalls.every(c => !c.includes('123-45-6789') && !c.includes('38-1234567')));
check('security log has steps, no values', w.events.filter(e => e.type === 'MUNDO_AGENT_STEP').length === 14 && !w.events.some(e => e.d.includes('52341')));
check('wrong website refused', (() => { const w2 = world({replies: [{action: 'wait'}]}); const r = w2.call({action: 'start', token: 'TOK-EMP', returnId: 'R1'}).runId;
  return /only works on SuccessTax/.test(w2.call({action: 'step', token: 'TOK-EMP', runId: r, observation: {...P, url: 'https://evil.example/'}}).error); })());
// return changes mid-run -> stops
w = world({replies: [{action: 'wait'}]});
const r2 = w.call({action: 'start', token: 'TOK-EMP', returnId: 'R1'}).runId;
w.g.evaluateHandoff = () => ({allowed: false, blockers: ['OPEN_RED_FLAGS']});
check('new RED flag mid-run stops the agent', /return changed/.test(w.call({action: 'step', token: 'TOK-EMP', runId: r2, observation: P}).error));
// kill switch
w = world({aiPaused: true});
const r3 = w.call({action: 'start', token: 'TOK-EMP', returnId: 'R1'}).runId;
check('Tax Platform AI kill switch respected', /kill switch/.test(w.call({action: 'step', token: 'TOK-EMP', runId: r3, observation: P}).error));
// finish flow
w = world({replies: [{action: 'finished', message: 'done'}]});
const r4 = w.call({action: 'start', token: 'TOK-EMP', returnId: 'R1'}).runId;
check('finished -> ready for review', w.call({action: 'step', token: 'TOK-EMP', runId: r4, observation: P}).status === 'READY_FOR_REVIEW');
check('runs list + stop', w.call({action: 'runs', token: 'TOK-EMP'}).runs.length === 1 && w.call({action: 'stop', token: 'TOK-EMP', runId: r4}).run.status === 'STOPPED');

console.log('PASS', pass.length, '\n ' + pass.join('\n '));
console.log('FAIL', fail.length, '\n ' + fail.join('\n '));
process.exit(fail.length ? 1 : 0);
