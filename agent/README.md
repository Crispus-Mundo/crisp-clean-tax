# Crispus Mundo Tax Agent

Prepares **signed-off** returns inside SuccessTax while the preparer watches. It never e-files, signs, pays or deletes.

| Piece | Where | What it does |
|---|---|---|
| Brain | `server/MundoTaxAgent.gs`, installed in the **Tax Platform** Apps Script | Sign-in (Tax Platform email + PIN), client scope, review/consent gate, decides each step with Claude, checks it, logs it |
| Chrome extension | `extension/` | Reads the SuccessTax screen, does the step, repeats. Toolbar button: gold **CM** |
| Phone & computer app | this folder (`/agent/`) on GitHub Pages | Returns ready/not ready, live progress, pause/stop, school district. Install from the browser |

No client data is stored in this repository or on GitHub Pages — everything stays in the Tax Platform (your Google account).

Tests: `node server/test_server.js` (37 checks) · `node tests/run_extension.js` (15, real Chromium) · `node tests/run_app.js` (5, phone size).
