// Regenerates the README screenshots from the real app, so they can never drift
// from what the demo actually shows. Run against `vite preview`:
//
//   npm run build && npx vite preview --port 4173 &
//   npm run screenshots
//
// Writes to ../screenshots/ (repo root), overwriting in place.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'screenshots');
const baseUrl = process.argv[2] ?? 'http://localhost:4173/';

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});

// vis-network's hierarchical layout is deterministic, but it animates into
// place; give each view time to settle before capturing.
const settle = (ms = 1200) => page.waitForTimeout(ms);

async function shot(name) {
  await page.screenshot({ path: join(outDir, name) });
  console.log(`wrote screenshots/${name}`);
}

// Click a node by asking vis-network where it drew it.
async function clickNode(predicateSource) {
  const target = await page.evaluate((src) => {
    const match = new Function('id', `return (${src})(id)`);
    const s = window.__logicSim;
    const id = s.nodes.getIds().find(i => match(String(i)));
    if (!id) return null;
    const dom = s.network.canvasToDOM(s.network.getPositions([id])[id]);
    const r = document.querySelector('#app canvas').getBoundingClientRect();
    return { id, x: r.x + dom.x, y: r.y + dom.y };
  }, predicateSource);
  if (!target) throw new Error(`no node matched ${predicateSource}`);
  await page.mouse.click(target.x, target.y);
  await settle(600);
  return target.id;
}

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await settle();

// 1. The default per-gate view of the 4-bit adder, with values propagated so
//    the graph is coloured rather than uniformly "all zero".
await page.fill('#bitInput', '101101011');
await page.click('#applyInputs');
await settle(800);
await shot('circuit-graph.png');

// 2. Dependency highlight: click an OUTPUT to light up everything feeding it.
await clickNode('(id) => id === "COUT"');
await shot('output-dependencies.png');

// 3. Input toggle propagation on the same circuit.
await page.reload({ waitUntil: 'networkidle' });
await settle();
await page.fill('#bitInput', '111111111');
await page.click('#applyInputs');
await settle(800);
await shot('input-toggle.png');

// 4. The module overview — the 64-bit adder collapsed to one box per module.
//    This is the view the hosted demo could not reach before the sample
//    selector existed.
await page.selectOption('#sampleSelect', 'adder64');
await settle(3000);
await page.fill('#bitInput', '1'.repeat(128));
await page.click('#applyInputs');
await settle(2500);
await shot('module-overview.png');

// 5. "What's inside a module" preview panel.
await clickNode('(id) => id.startsWith("module_")');
await settle(1000);
await shot('module-preview.png');

await browser.close();
console.log('done');
