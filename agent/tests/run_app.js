// Phone-size test of the installable app against MundoTaxAgent.gs on the stand-in Tax Platform.
const {chromium, devices} = require('playwright'); const path = require('path'); const fs = require('fs'); const {world} = require('../server/harness');
(async () => {
  const W = world({replies: Array(5).fill({action: 'wait'})});
  const b = await chromium.launch(); const ctx = await b.newContext({...devices['Pixel 7']});
  const root = path.resolve(__dirname, '..');
  await ctx.route('https://agent.test/**', r => { const p = new URL(r.request().url()).pathname.replace(/^\/$/, '/index.html'); const f = path.join(root, p);
    const type = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    fs.existsSync(f) ? r.fulfill({contentType: type, body: fs.readFileSync(f)}) : r.fulfill({status: 404}); });
  await ctx.route('https://script.google.com/**', r => r.fulfill({contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: W.g.doPost({postData: {contents: r.request().postData()}}).body}));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('https://agent.test/');
  const pass = [], fail = []; const check = (n, c, x) => (c ? pass : fail).push(n + (c ? '' : ' >> ' + String(x).slice(0, 200)));
  await p.fill('#email', 'cyars@x'); await p.fill('#pin', '2468'); await p.click('#go');
  await p.waitForSelector('[data-r]');
  check('returns list on phone', (await p.locator('#rets').textContent()).includes('Jordan A Taylor'));
  await p.locator('[data-r="R1"]').click(); await p.waitForSelector('#sd');
  check('ready return shows lines', /52341.12/.test(await p.locator('#retDetail').textContent()));
  const run = W.call({action: 'start', token: 'TOK-EMP', returnId: 'R1'}).runId;
  W.call({action: 'step', token: 'TOK-EMP', runId: run, observation: {url: 'https://www.mytaxoffice.com/x', elements: []}});
  await p.click('#refresh'); await p.waitForSelector('[data-run]'); await p.locator('[data-run]').first().click();
  await p.waitForSelector('#p');
  check('live run visible', /running/.test(await p.locator('#runDetail').textContent()));
  await p.click('#p'); await p.waitForFunction(() => /paused/.test(document.getElementById('runDetail').textContent));
  check('pause from phone works', W.call({action: 'run', token: 'TOK-EMP', runId: run}).run.status === 'PAUSED');
  check('no page errors (CSP ok)', !errs.length, errs);
  console.log('PASS', pass.length, pass.join(' | ')); console.log('FAIL', fail.length, fail.join(' | '));
  await b.close(); process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
