// End-to-end smoke test: starts the built app in a real browser and exercises
// the paths the hosted demo advertises. Run against `vite preview` (see
// `npm run smoke`), so it tests the production bundle CI deploys, not the dev
// server — three of this project's past bugs were invisible under `vite dev`.
//
// Usage: node tools/smoke.mjs [baseUrl]
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:4173/';

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const consoleErrors = [];
const failedRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));
page.on('requestfailed', r => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));

const state = () => page.evaluate(() => {
  const s = window.__logicSim;
  const ids = s.nodes.getIds();
  return {
    nodeCount: ids.length,
    edgeCount: s.edges.getIds().length,
    moduleIds: ids.filter(i => String(i).startsWith('module_')),
    inputBits: document.getElementById('bitInput').value,
    outputBits: document.getElementById('bitOutput').value,
    // Node background colors, so we can assert propagation actually recolored
    // the graph rather than just that a click was registered.
    greenNodes: s.nodes.get().filter(n => n.color?.background === '#a0f0a0').length,
  };
});

console.log(`\nsmoke: ${baseUrl}`);

// --- 1. The page loads and renders the default circuit -----------------------
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const title = await page.title();
check('page title is not the Vite template default', title !== 'Vite + TS', JSON.stringify(title));
check('canvas rendered', await page.locator('#app canvas').count() === 1);

const adder4 = await state();
check('4-bit adder: 9 input bits', adder4.inputBits.length === 9, `got ${adder4.inputBits.length}`);
check('4-bit adder: 5 output bits', adder4.outputBits.length === 5, `got ${adder4.outputBits.length}`);
check('4-bit adder: renders per-gate (no modules)', adder4.moduleIds.length === 0);
// 9 inputs (A1-A4, B1-B4, CIN) + 20 gates (5 per bit-slice x 4) + 5 outputs.
check('4-bit adder: 34 nodes', adder4.nodeCount === 34, `got ${adder4.nodeCount}`);

// --- 2. Input propagation actually recolors the graph ------------------------
// Set all inputs high via the bit-string field, which drives the same
// applyBitString path the INPUT-node click handler feeds.
await page.fill('#bitInput', '1'.repeat(9));
await page.click('#applyInputs');
await page.waitForTimeout(400);
const afterInputs = await state();
check('setting all inputs high propagates to outputs',
  afterInputs.outputBits === '11111',
  `outputs=${afterInputs.outputBits}`);
check('propagation turns nodes green', afterInputs.greenNodes > 20, `${afterInputs.greenNodes} green nodes`);

// --- 3. The bundled 64-bit adder reaches module-overview mode ----------------
// This is the path that was unreachable on the hosted demo before the sample
// selector existed: a visitor has no Bristol file to upload.
await page.selectOption('#sampleSelect', 'adder64');
await page.waitForTimeout(2500);
const adder64 = await state();
check('64-bit adder: 128 input bits', adder64.inputBits.length === 128, `got ${adder64.inputBits.length}`);
check('64-bit adder: 64 output bits', adder64.outputBits.length === 64, `got ${adder64.outputBits.length}`);
check('64-bit adder: renders as module overview', adder64.moduleIds.length > 5,
  `${adder64.moduleIds.length} modules`);
check('64-bit adder: has edges', adder64.edgeCount > 100, `${adder64.edgeCount} edges`);

// --- 4. Clicking a module opens the "what's inside" preview ------------------
// Click via the canvas at the module's real rendered position, so this
// exercises vis-network hit-testing (the layer that a past bug had silently
// swallowing clicks), not just the handler.
// Ask vis-network where it actually drew the node, then click that point with a
// real mouse event — this exercises canvas hit-testing and the layering above
// the canvas, which is precisely where a past bug silently swallowed clicks.
const target = await page.evaluate(() => {
  const s = window.__logicSim;
  const moduleId = s.nodes.getIds().find(i => String(i).startsWith('module_'));
  if (!moduleId) return null;
  const canvasPos = s.network.getPositions([moduleId])[moduleId];
  const domPos = s.network.canvasToDOM(canvasPos);
  const r = document.querySelector('#app canvas').getBoundingClientRect();
  return { moduleId, x: r.x + domPos.x, y: r.y + domPos.y };
});
check('module node exists to click', !!target, target?.moduleId ?? 'none');

let previewOpened = false;
if (target) {
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(500);
  previewOpened = await page.locator('#modulePreviewModal:not(.hidden)').count() > 0;
}
check('clicking a module opens the preview panel', previewOpened,
  target ? `${target.moduleId} at (${Math.round(target.x)}, ${Math.round(target.y)})` : '');

if (previewOpened) {
  await page.waitForTimeout(600);
  const previewTitle = await page.locator('#modulePreviewTitle').textContent();
  check('preview names the module and its gate count',
    /Module \d+ — \d+ gates/.test(previewTitle ?? ''), JSON.stringify(previewTitle));
  check('preview renders its own graph canvas',
    await page.locator('#modulePreviewContainer canvas').count() === 1);
  await page.click('#closeModulePreview');
}

// --- 5. No errors anywhere ---------------------------------------------------
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

await browser.close();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
