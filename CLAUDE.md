# CLAUDE.md

Working notes for anyone (human or agent) developing this repo. Conventions,
architecture, and the traps that have actually cost time here.

## Commands

All frontend commands run from `logic-sim/`; all backend commands run from the
**repository root**.

```bash
# Frontend
cd logic-sim
npm ci                 # install (see the lockfile note below)
npm run dev            # dev server on :5173
npm run test           # Vitest unit tests
npx tsc --noEmit       # typecheck (the dev server does NOT typecheck)
npm run build          # tsc + vite build -> dist/
npm run smoke          # end-to-end browser test, needs a server on :4173
npm run screenshots    # regenerate ../screenshots/, needs a server on :4173

# Backend (from the repo ROOT, not from PyZ3Server/)
python -m venv .venv && .venv/Scripts/activate     # macOS/Linux: source .venv/bin/activate
pip install -r PyZ3Server/requirements-dev.txt
ruff check PyZ3Server
python -m pytest PyZ3Server
uvicorn PyZ3Server.server:app --reload             # :8000
```

To run the smoke test or screenshot capture:

```bash
cd logic-sim && npm run build
npx vite preview --port 4173 --strictPort &
npm run smoke
```

## Architecture

Two independent halves that talk over HTTP:

```
logic-sim/  (TypeScript + Vite, no framework)
  shared/parser.ts  Bristol circuit text -> LogicGraph
  logic.ts          simulation, dependency tracing, bit-string I/O
  tools.ts          levelling, module grouping, overview + preview graph building
  main.ts           all DOM wiring, vis-network rendering, colouring
  shared/shared.ts  the HTTP client for PyZ3Server

PyZ3Server/  (FastAPI + Z3)
  parser.py         LogicCircuit -> Z3 variables + constraints
  solver.py         solve_circuit (one model) / solve_all (up to MAX_MODELS)
  server.py         POST /solve, POST /truth-table
```

**The central data structure is `LogicGraph`** — `Record<string, LogicNode>`,
where a node's `inputs` are the **ids of other nodes**, not wire numbers. The
parser resolves wire numbers to producer-node ids exactly once; everything
downstream works in node-id space. Ids are `IN_<wire>` / `OUT_<wire>` /
`gate_<n>` for parsed circuits, but the built-in `graph4bitAdder` uses friendly
ids (`A1`, `COUT`) — **any code that parses a number out of an id must tolerate
ids that have none** (see `sortByWireNumber` / `applyBitString`).

### The two render modes

`drawGraph` picks per circuit:

- **Per-gate (flat)** — one node per gate. Used when `maxLevel <= 30`
  (`MODULE_VIEW_LEVEL_THRESHOLD`).
- **Module overview** — one box per module from `groupByModules`, with original
  `INPUT`/`OUTPUT` nodes still individually rendered and interactive. Used above
  that depth, but only when the graph has `<= 5000` nodes
  (`MODULE_VIEW_MAX_NODES`); larger circuits fall back to flat, because
  `groupByModules` is too slow to run interactively at that size.

A `LogicNode` structurally satisfies `OverviewNode`, so the flat path renders
`graph` itself with no separate node-building code.

### Invariants worth not breaking

- **A module's `outputs` are its own node ids**, not its consumers' ids. Getting
  this backwards corrupts `producerModule`, which silently produces edges to
  nonexistent nodes, which makes `computeNodeLevelsFast` unable to resolve
  in-degree, which collapses the whole overview onto one row. `tools.test.ts`
  pins this.
- **Every gate input must be evaluated**, even when the result is already
  determined. `simulateGraph` deliberately builds an array before reducing with
  `.every()`/`.some()`, because short-circuiting leaves later inputs with no
  memoized value — invisible until something (the module preview) needs *every*
  internal gate's value. `logic.test.ts` pins this.
- **No native recursion over a circuit.** `simulateGraph` and
  `findDependenciesForOutput` use explicit heap stacks; `sha256.txt` is ~5,400
  levels deep and blows the JS call stack instantly otherwise.
- **One rendered edge per underlying wire.** Several raw wires can resolve onto
  the same module-to-module connection; colouring a bundle by its aggregate
  makes it read as "mixed" almost always. Edge ids derive from the wire id
  (unique), not the resolved module id (not unique).
- **The frontend and the solver must agree on the gate set.** `parser.ts` maps
  `XOR/AND/OR/INV/NAND/NOR`; `convert_to_z3` must handle all of them. NAND and
  NOR were missing there for a long time, so circuits that rendered and
  simulated perfectly answered HTTP 500 on the first click of **Solve**.

## Gotchas

- **`npm run dev` does not typecheck.** Only `tsc` does. Run `npx tsc --noEmit`
  (or `npm run build`) before assuming a change compiles.
- **Regenerate `package-lock.json` with npm 10, not npm 11.** CI uses the npm
  bundled with Node 22 (npm 10.x). npm 11 records optional peer deps loosely
  enough that `npm ci` under npm 10 rejects the result outright
  (`Missing: esbuild@… from lock file`). Reproduce CI's install with
  `npx npm@10.9.3 ci` before pushing a lockfile change.
- **`vitest` 4 peer-depends on vite ^6–^8.** Keep `vite` in that range;
  a mismatch is what caused the lockfile problem above.
- **vis-network draws to a canvas**, so there is nothing in the DOM to assert
  on. Use the `window.__logicSim` test hook (defined in `main.ts`) — it exposes
  the live `DataSet`s and the `Network`, so tests can read real node/edge state
  and click a node at `network.canvasToDOM(network.getPositions([id])[id])`.
- **Don't lay the canvas out underneath the toolbar.** `#app` and `#toolbar` are
  flex siblings on purpose. When `#app` was absolutely positioned at `top: 0`,
  controls floated above it only visually (`z-index`) while the canvas kept
  receiving clicks behind them, silently eating clicks on the top row of nodes.
  A hardcoded `top:` offset also had to be re-tuned every time a toolbar row was
  added.
- **A flex child that hosts vis-network needs `min-height: 0`.** Otherwise the
  default `min-height: auto` and vis-network's own sizing feed back into each
  other and the container never settles on a size (the symptom is a blank
  canvas, and Playwright reporting "element is not stable").
- **The backend must be started from the repo root** — `server.py` does
  `from PyZ3Server.classes import …`, so `PyZ3Server` has to be importable as a
  package.
- **`/truth-table` is `2^n`** in the module's input count. The UI can open a
  module with enough inputs to make this very slow; there is no guard.
- **CORS is hardcoded to `http://localhost:5173`** in `server.py`. Change it
  there if you serve the frontend from anywhere else (e.g. `vite preview` on
  :4173, which is why the smoke test does not exercise Solve).

## Testing conventions

- Frontend unit tests are Vitest, colocated (`*.test.ts`). The parser tests read
  the real circuit files, so their counts double as format regression pins.
- Backend tests use a 7-gate slice copied verbatim from `64-bit-adder.txt`
  rather than a hand-rolled lookalike, so they exercise real adder wiring.
- **Reproduce a bug as a failing test before fixing it.** Several fixes here
  were verified by `git stash`-ing the fix and confirming the new test actually
  goes red against the old code.
- The smoke test runs against `vite preview` (the production bundle), not the
  dev server — multiple past bugs were invisible under `dev`.

## Docs to keep in sync

`README.md` (what it is / how to run), `ROADMAP.md` (forward work and a detailed
Done log), `KNOWNISSUES.md` (measured, reproducible defects), `NOTICE.md`
(third-party circuit files and licences). If you change what the demo can do,
update the README's *Live demo* section and re-run `npm run screenshots`.
