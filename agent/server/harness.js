// Stand-in Tax Platform for tests: runs MundoTaxAgent.gs with fake versions of the Tax Platform's own functions.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'MundoTaxAgent.gs'), 'utf8');
function world(opts = {}) {
  const tables = {
    RETURNS: [{id: 'R1', clientId: 'C1', taxYear: 2025, returnType: '1040', stage: 'REVIEW', reviewStatus: 'SIGNED_OFF', consentStatus: 'GRANTED'},
              {id: 'R2', clientId: 'C2', taxYear: 2025, returnType: '1040', stage: 'PREP', reviewStatus: '', consentStatus: 'GRANTED'},
              {id: 'R3', clientId: 'C9', taxYear: 2025, returnType: '1040', stage: 'REVIEW', reviewStatus: 'SIGNED_OFF'}],
    CLIENTS: [{id: 'C1', displayName: 'Jordan A Taylor'}, {id: 'C2', displayName: 'Pat Example'}, {id: 'C9', displayName: 'Other Preparer Client'}],
    ENTRIES: [
      {returnId: 'R1', form: '1040', line: '1a', lineLabel: 'Wages', sourceField: 'W-2 box 1', sourceValue: '52341.12', proposedValue: 52341.12, sourceDocumentId: 'DOC111111', preparerStatus: 'APPROVED'},
      {returnId: 'R1', form: '1040', line: '25a', lineLabel: 'Federal withholding', sourceField: 'W-2 box 2', sourceValue: '6100.00', proposedValue: 6100, sourceDocumentId: 'DOC111111', preparerStatus: 'APPROVED'},
      {returnId: 'R1', form: 'W2', line: 'b', lineLabel: 'Employer EIN', sourceField: 'W-2 box b EIN', sourceValue: '**-***4567', proposedValue: '', sourceDocumentId: 'DOC111111', preparerStatus: 'APPROVED'},
      {returnId: 'R1', form: '1040', line: '2b', lineLabel: 'Taxable interest', sourceField: '1099-INT box 1', sourceValue: '41.22', proposedValue: 41.22, sourceDocumentId: 'DOC222222', preparerStatus: 'APPROVED'},
      {returnId: 'R1', form: '1040', line: '3a', lineLabel: 'Not approved line', sourceField: 'W-2 box 3', sourceValue: '777', proposedValue: 777, sourceDocumentId: 'DOC111111', preparerStatus: 'PROPOSED'},
    ],
  };
  const sheets = {}, props = {}, events = [], claudeCalls = [];
  const sheetObj = name => {
    const data = sheets[name];
    return {
      getRange: (r, c, nr, nc) => ({ setValues: v => { v.forEach((row, i) => { data[r - 1 + i] = row.slice(); }); return { setFontWeight() {} }; } }),
      setFrozenRows() {}, appendRow: row => data.push(row.slice()), getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }),
    };
  };
  const replies = (opts.replies || []).slice();
  const ctxFor = t => t === 'TOK-EMP' ? {name: 'Cyars', email: 'cyars@x', tier: 'OWNER', scope: 'mine', allowed: ['C1', 'C2']}
    : t === 'TOK-INT' ? {name: 'Issa', email: 'issa@x', tier: 'INTERN', scope: 'mine', allowed: ['C1']} : null;
  const g = {
    STAFF_CTX_: null, console,
    staffLogin: (email, pin) => { if (pin !== '2468') throw new Error('Wrong email or PIN.'); return {token: 'TOK-EMP', user: {name: 'Cyars', email, tierLabel: 'Employee', allClients: false}}; },
    staffLogout: () => {},
    staffSession_: t => { const c = ctxFor(t); if (!c) throw new Error('STAFF_SESSION_EXPIRED: Please sign in.'); return c; },
    staffTaxClientInScope_: (ctx, cid) => ctx.scope === 'all' || ctx.allowed.includes(cid),
    rows_: n => tables[n].map(r => ({...r})),
    find_: (n, k, v) => tables[n].find(r => r[k] === v),
    evaluateHandoff: id => { const b = []; const r = tables.RETURNS.find(x => x.id === id);
      if (r.consentStatus !== 'GRANTED') b.push('CONSENT_NOT_GRANTED'); if (opts.redFlag && id === 'R1') b.push('OPEN_RED_FLAGS');
      return {allowed: !b.length, blockers: b}; },
    andrewRows_: () => [],
    cgRedact_: s => ({text: String(s).replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****'), count: 0}),
    cgAiPaused_: () => !!opts.aiPaused,
    agentClaude_: (system, content) => { claudeCalls.push(content); const r = replies.shift(); return typeof r === 'function' ? r(JSON.parse(content)) : JSON.stringify(r || {action: 'wait'}); },
    securityEvent_: (type, status, sev, d) => events.push({type, status, d: JSON.stringify(d)}),
    db_: () => ({ getSheetByName: n => sheets[n] ? sheetObj(n) : null, insertSheet: n => { sheets[n] = []; return sheetObj(n); } }),
    LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
    Utilities: {getUuid: () => 'u' + Math.random().toString(16).slice(2) + '-x', formatDate: d => d.toISOString()},
    PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }})},
    ContentService: {MimeType: {JSON: 'json'}, createTextOutput: s => ({setMimeType: () => ({body: s})})},
  };
  vm.createContext(g); vm.runInContext(src, g);
  const call = body => JSON.parse(g.doPost({postData: {contents: JSON.stringify(body)}}).body);
  return {g, call, events, claudeCalls, sheets};
}

module.exports = {world};
