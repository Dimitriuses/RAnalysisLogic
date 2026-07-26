# Roadmap

Outstanding work for RAnalysisLogic. The core is functional and the code has been
cleaned up (see [Done](#done)); most of what remains is about making the project
legible and credible to a visitor, plus a few research directions.

Priorities: **High** = portfolio impact, **Medium** = quality & credibility,
**Low** = optional polish.

## Medium priority — quality & credibility

- [ ] **`sha256.txt` doesn't actually work end-to-end in the browser —
  two separate bugs, both only found once someone actually tried it live.**
  The README previously claimed it "loads and simulates"; that was never
  verified against a real browser upload, only against `parseCircuitFile` in
  isolation (`parser.test.ts`). It parses fine (~1s) and
  `computeNodeLevelsFast` is fine too (~1s, maxLevel 5383), but:
  - `groupByModules` didn't finish within 60s on the same graph in a
    standalone timing test — never even got as far as rendering. Almost
    certainly `countUniqueIO`'s `Object.values(graph).filter(...)` — a full
    scan of the whole graph — running once per node processed, i.e. roughly
    O(n²)-ish over 117k nodes. `MODULE_VIEW_MAX_NODES` (`main.ts`) currently
    just avoids calling it above 5000 nodes rather than fixing it, so
    `sha256.txt` falls back to the flat per-gate render instead of hanging.
    Needs a reverse-dependency index built once up front instead of
    rescanning the full graph per node.
  - Separately, even with that guard, uploading `sha256.txt` live throws
    `Maximum call stack size exceeded` and never finishes — `Output bits`
    stays at its stale previous value and the canvas stays blank. Almost
    certainly `simulateGraph`'s recursive `evaluate()` (`logic.ts`) blowing
    the JS call stack, since maxLevel 5383 means a recursion depth in the
    thousands for a single output. `findDependenciesForOutput` is built the
    same recursive way and likely has the same problem. Fixing either the
    module-overview performance or the visualizer alone won't make
    `sha256.txt` usable — this simulation-side crash blocks it regardless of
    rendering strategy, and would need an iterative (explicit-stack or
    topologically-ordered) rewrite of the evaluation itself.

## Low priority — optional polish

- [ ] **Remove `logic-sim/src/shared/logic-graph1.json`** (2 KB) if it's an unused
  sample.
- [ ] **`sortByWireNumber`/`applyBitString`'s wire-number parsing silently no-ops
  on the default 4-bit adder graph.** It extracts the numeric suffix from
  `IN_<wire>`/`OUT_<wire>` ids, which only exist on circuits parsed from a
  Bristol file. The hardcoded `graph4bitAdder` (`graphs.ts`) instead uses
  plain ids like `"OUT1"`/`"COUT"` with no `_<number>` to extract, so every
  comparison is `NaN` and the sort is a no-op — it currently *looks* correct
  only because `Array.sort` is stable and the object's own property-definition
  order already happens to match the intended bit order. Harmless today, but
  fragile: reordering `graph4bitAdder`'s properties, or adding another
  hardcoded graph with different id conventions, would silently scramble the
  displayed/typed bit strings with no error. Worth either giving
  `graph4bitAdder`'s ids the same `_<wire>` convention, or making the sort
  fall back sanely (e.g. leave order unchanged, explicitly) when it can't
  parse a wire number.

## Research directions

Not blockers — the README's "Known limitations" already frames these honestly as
future work:

- [ ] **Collision search** — the original goal: model two circuit instances sharing
  an output and ask Z3 for differing inputs.
- [ ] **Scale rendering and solving** toward the full SHA-256 circuit (~116k gates),
  which the current visualizer and brute-force solver don't handle.

## Done

- Rewrote the README (accurate SHA-256 framing, corrected the circuit-format
  description, added setup and "Generating circuit files" sections).
- Removed the redundant 9.4 MB `logic-graph.json` from the working tree.
- Renamed misspelled files (`clasess.py` → `classes.py`, `parcer.py`/`parcer.ts`
  → `parser.py`/`parser.ts`) and updated all imports.
- Translated all in-code comments to English.
- Fixed a Pydantic default bug in `classes.py` (`= None,` tuple → `= None`).
- Fixed the parser to auto-detect the header layout, so it no longer drops the
  first gate of old-Bristol-format circuits like `sha256.txt`.
- Added `PyZ3Server/requirements.txt` (pinned to the versions verified against
  the current code) and pointed the README's backend setup at it instead of an
  inlined pip list.
- Sorted the "Input bits" / "Output bits" display by wire number to match the
  circuit's own MSB-first ordering (they previously showed raw object-insertion
  order, which didn't line up with what `settupInputs` accepted or with a
  coherent numeric value).
- Shipped the GitHub Pages live demo: `.github/workflows/deploy-pages.yml`
  builds `logic-sim` (with `--base=/RAnalysisLogic/`) and deploys it on push to
  `main`. Solve buttons now `.catch()` the fetch and show a plain-language
  disclaimer (no backend on a static deploy) instead of failing silently —
  considered and rejected a closed-form client-side solver and a
  precomputed-example cache for this, since both would be exploiting that an
  adder is trivially invertible rather than actually demonstrating the
  Z3-backed solver the rest of the project is about.
- Added `screenshots/` (circuit graph, `INPUT` toggle propagation, `OUTPUT`
  dependency highlight — all on the default 4-bit adder) and embedded them in
  the README.
- Added an MIT `LICENSE`.
- Added a parser regression test suite ([Vitest](https://vitest.dev/),
  `logic-sim/src/shared/parser.test.ts`, `npm run test`): pins the gate/input/
  output counts for both the old-Bristol 2-line header (`sha256.txt`, 116246
  gates) and Bristol Fashion 3-line header (`64 Bit Adder.txt`, 314 gates), and
  asserts every `OUTPUT` resolves to a real producer node.
- Added a backend pytest suite (`PyZ3Server/test_server.py`,
  `PyZ3Server/requirements-dev.txt`, `python -m pytest PyZ3Server`) covering
  `/solve` (sat via fixed inputs, unsat via contradictory fixed inputs +
  outputs, multi-solution enumeration via fixed outputs) and `/truth-table`
  against all 16 rows — using a 2-bit slice copied verbatim (same wire numbers
  and gate types) from the first 7 gate lines of `64 Bit Adder.txt`, so the
  test exercises the real adder wiring. Writing the unsat case surfaced a real
  bug: `solve_all` always returned a list (`[]` on unsat), so `/solve`'s
  `if result is None` unsat check never fired and every unsat query silently
  came back `{"status": "sat", "solution": []}`. Fixed `solve_all` to return
  `None` when empty, matching `solve_circuit`'s existing contract — which in
  turn meant `main.ts`'s "Solve (fix outputs)" handler could now actually see
  `data.solution === null` for the first time, so it now checks
  `status`/`solution` before calling `populateDropdown` instead of crashing
  into the "backend unavailable" disclaimer.
- Added minimal CI (`.github/workflows/ci.yml`, on push to `main` and on every
  PR) plus a CI badge in the README. Frontend job: `tsc --noEmit` +
  `npm run test` (Vitest). Backend job: `ruff check PyZ3Server` + the pytest
  suite. Scoped ruff to pyflakes rules only (`PyZ3Server/pyproject.toml`,
  `select = ["F"]`) rather than its full default set, which is mostly
  pyupgrade style modernization (`Dict` → `dict`, `Optional` → `X | None`) —
  that's a much bigger, separate cleanup, not a "minimal CI" concern. Fixed
  the ~15 real pyflakes hits this surfaced: unused imports across
  `server.py`/`parser.py`/`solver.py`/`test.py`, and 4 unused `start`/`end`
  timer variables (and the now-unused `time` import) in `solver.py` that only
  fed already-commented-out print statements.
- Modernized the backend's type hints (`typing.Dict`/`List`/`Optional[X]` →
  the builtin `dict`/`list`/`X | None` syntax) across `classes.py`,
  `parser.py`, and `solver.py`, plus the import-sort cleanup that came with it
  (`ruff --select UP,I001 --fix`, then removing the now-unused `typing`
  imports the fixer left behind).
- Cleaned up dead/debug code:
  - `PyZ3Server/solver.py`: removed the fully commented-out alternative
    `get_all_models` implementation (a dead `while`-loop version of the active
    `for`-loop one) and assorted stray debug comments.
  - `logic-sim/src/main.ts`: removed a second, fully redundant `fileInput`
    'change' listener — an earlier draft that re-parsed the file into a
    shadowed local `graph` and never updated app state, superseded by the
    listener that actually calls `groupByModules`/`generateInputs`/`drawGraph`
    (both fired on every upload, parsing the file twice). Also removed the
    dead `inputIds`-driven loop in the "Set Inputs" handler (`inputIds` was
    never populated — always empty, so the loop was a no-op even before the
    listener that would've populated it was itself dead) and a large block of
    commented-out scaffolding/console.logs throughout. Verified live
    (Playwright against the dev server) that uploading `64 Bit Adder.txt`
    still parses/redraws/populates the bit displays correctly with no console
    errors. 345 → 246 lines, identical production bundle hash (confirms the
    removed code was already unreachable, not just untidy).
  - `logic-sim/src/tools.ts`: deleted three fully unused, superseded
    functions — `computeNodeLevels` (the one with the flagged `console.log`
    inside its hot DFS loop), `computeNodeLevelsTopological`, and `tarjan` —
    plus `groupNodesByLevel`, none referenced anywhere outside their own
    definitions (confirmed by grep across `logic-sim/src`); all superseded by
    `computeNodeLevelsFast` and `groupByModules`. Also removed dead
    commented-out alternative code inside `groupByModules`. 305 → ~110 lines,
    identical production bundle hash.
- Deleted `PyZ3Server/test.py` — it was pure z3 scratch code (a basic AND-gate
  demo plus an unrelated tqdm progress-bar experiment), nothing that exercised
  the project's own `LogicCircuit`/`convert_to_z3` code, so there was nothing
  in it worth promoting.
- Reconnected `solve_circuit` to `/solve`. It had gone unused (and its import
  removed) after the earlier `solve_all` bugfix — but per design intent it's
  the right default for large circuits, where enumerating solutions is
  wasted work if you just want one answer fast. `LogicCircuit` gained a
  `find_all_solutions` field (default `False` → single answer via
  `solve_circuit`; `True` → up to 1000 via `solve_all`, unchanged from
  before). Wired the frontend's two Solve buttons to match their actual
  intent: "Solve" (fixed inputs) leaves the default alone, since a
  fully-fixed-input circuit only has one solution anyway; "Solve (fix
  outputs)" now explicitly sets `find_all_solutions: true`, since its
  dropdown UI is specifically for browsing multiple solutions. Verified live
  against the running backend (`curl`) that the same fixed-outputs query
  returns 1 solution by default and all 3 valid `(A, B)` pairs with the flag
  set.
- Added unit-level tests for `convert_to_z3`'s gate/error paths that the
  existing adder-slice fixture never touches (it's pure XOR/AND): the `NOT`
  gate, the "unknown gate type" `ValueError`, and the "missing second input"
  `ValueError` for XOR/AND/OR. Also split the fixed-outputs `/solve` test into
  two — one pinning the new single-solution default, one for
  `find_all_solutions: true` — since the behavior change above would
  otherwise have silently changed what the original test was asserting.
- Fixed two CI failures that only showed up on a genuinely clean environment
  (my local `.venv` masked both, since it had picked up extra packages over
  the course of this project that neither requirements file ever declared):
  - `npm ci` failed in both workflows with "Missing: esbuild@0.28.1 from lock
    file". The lock file was generated with npm 11 (lenient about recording
    optional peer deps — here, `vitest`'s nested bundled `vite@8.1.5`
    optionally peers on `esbuild ^0.27/^0.28`); CI's Node 20 bundles npm 10,
    which validates the same lock file more strictly and refuses to proceed
    without every optional-peer platform variant explicitly recorded.
    Reproduced locally with `npx npm@10.8.2 ci`, then regenerated
    `logic-sim/package-lock.json` with that same npm version so it now
    satisfies both. `package.json` itself is unchanged — no dependency was
    added, removed, or bumped.
  - `python -m pytest PyZ3Server` failed CI with
    `ModuleNotFoundError: No module named 'httpx'` — `fastapi.testclient.TestClient`
    requires `httpx`, but it was never declared in `requirements-dev.txt`; it
    happened to already be present in my local `.venv`. Reproduced in a truly
    fresh venv (`python -m venv` + install from `requirements-dev.txt` only)
    and added `httpx==0.28.1` there.
- Fixed "Solve (fix outputs)" requiring the user to already know a valid
  answer before they could ask the solver for one: "Output bits:" was
  `readonly` in `index.html`, with no way to type a target and no "Set
  Outputs" button, so the only way `outputValues` ever changed was by clicking
  `INPUT` nodes and letting simulation derive it — circular for a feature
  whose whole point is "I don't know the inputs, find them for me." Removed
  `readonly`, added a "Set Outputs" button, and generalized `settupInputs` →
  `applyBitString` (it already worked on any `Record<string, boolean>` keyed
  by its own wire-sorted ids, just misleadingly named for inputs only) so both
  bit-string fields share one implementation. Verified live end-to-end
  (Playwright against both dev servers) that typing a target directly —
  with no input clicked first — and clicking "Set Outputs" then "Solve (fix
  outputs)" returns real solutions from the live backend.
- Fixed the visualizer not scaling past small circuits. A real per-gate render
  of `64 Bit Adder.txt` (~190 levels) auto-zoomed to fit and collapsed into an
  illegible mesh of crossing lines — sorting same-level nodes or tuning
  spacing wouldn't have fixed that; the actual problem was 190 sequential
  levels, not ordering or spacing. Added `buildModuleOverview` and
  `assignOverviewLevels` (`tools.ts`) using the existing `groupByModules`:
  circuits deeper than 30 levels (`MODULE_VIEW_LEVEL_THRESHOLD` in `main.ts`)
  now render one box per module instead of one per gate, with original
  `INPUT`/`OUTPUT` nodes still individually visible (and still fully
  interactive — click-to-toggle and dependency highlighting both work
  unchanged) so only the internal gate fan-out gets collapsed. The 64-bit
  adder now renders as 21 clearly-labeled module boxes in a readable diagonal
  chain instead of ~190 levels of noise. Two real bugs surfaced and got fixed
  along the way, both confirmed via Playwright against the live dev server:
  - A duplicate-edge-id crash (`Cannot add item: item with id
    module_0->module_1 already exists`) whenever a module depended on
    multiple wires produced by the same other module — fixed by deduping
    resolved module-to-module inputs.
  - `computeNodeLevelsFast` naturally puts every `INPUT` at level 0 and every
    `OUTPUT` at the max level, which is fine per-gate but crams all of a large
    circuit's 128 inputs onto one absurdly wide row in overview mode
    (everything auto-zoomed down to a single-pixel-tall sliver). Fixed by
    `assignOverviewLevels` re-anchoring each `INPUT`/`OUTPUT` next to the
    module that actually consumes/produces it, spreading them across the
    module chain instead.
  - Also fixed a latent bug this touched: the file-upload handler's
    `groupByModules(graph, levels)` diagnostic call used `levels` from
    *before* `drawGraph` recomputed it for the newly-uploaded graph (stale
    from whatever circuit was loaded previously), so it always logged
    "Modules found: 0" for any upload. Reordered so it runs after `drawGraph`.
  - Added a `MODULE_VIEW_MAX_NODES` (5000) safety cap after discovering
    `groupByModules` doesn't finish within 60s on `sha256.txt` (117,014
    nodes) — without it, uploading that file would call `groupByModules` and
    hang the tab, which is worse than the old flat-but-illegible render.
    Verified live: `sha256.txt` now falls back to flat rendering instead of
    hanging (though it still doesn't work end-to-end — see the `sha256.txt`
    item above, a separate `simulateGraph` crash blocks it regardless).
- Extended the module overview with the two things it was missing for
  actually tracing a signal: seeing what's inside a module, and not having
  the "lit path" go dark at module boundaries. This also closes the loop on
  why `groupByModules` existed in the first place — it was meant to enable
  module-level truth tables for optimizing the Z3 side (per `/truth-table` +
  `ModuleData`), never finished; this is the visual half of that idea.
  - **Module summary coloring**: a module has no single boolean value, so
    `updateColors` now summarizes it from its exported wires — green/red
    only when every one of them agrees, otherwise a neutral color, rather
    than guessing. Verified precisely via canvas pixel sampling (not just
    eyeballing screenshots): an all-zero circuit correctly shows every module
    red from the start (not neutral — all-false is itself an unambiguous
    summary); setting all 128 inputs true correctly turns some modules green
    and correctly leaves a module neutral where its exported wires
    legitimately disagree in that scenario.
  - **Dependency highlighting through modules**: clicking an `OUTPUT` now
    expands the existing `findDependenciesForOutput` result to also include
    any module whose internal gates intersect it, so the blue highlight
    continues through module boxes instead of stopping at their edge.
    Verified live: a deep/MSB-side output on the 64-bit adder (which
    genuinely depends on the carry chain through nearly every module) lights
    up all 20 modules and every input; a shallow output that depends on only
    2 raw gates correctly lights up nothing else.
  - **"What's inside" preview**: clicking a module opens a panel with its
    real internal gates as their own small flat graph (`buildModulePreviewGraph`
    in `tools.ts`), colored from the same simulation result as the main
    view — not re-simulated, so it's a snapshot at click time.
  - Building this surfaced two more real, previously-invisible bugs:
    - `simulateGraph`'s `AND`/`OR`/`NAND`/`NOR` cases evaluated inputs via
      `.every()`/`.some()` directly, which **short-circuit** — `.every()`
      stops at the first `false`, `.some()` at the first `true` — silently
      skipping (and never memoizing a value for) whichever inputs came
      after. Invisible before now because every caller only ever looked up
      `INPUT`/`OUTPUT` ids (always fully evaluated as recursion roots/leaves);
      the module preview was the first thing to need *every* internal
      gate's value. Fixed by mapping to an array first, forcing every input
      to be evaluated, before reducing with `.every()`/`.some()`. Added
      `logic.test.ts` as a regression test — confirmed it actually fails
      against the old code (temporarily reverted `logic.ts` via `git stash`
      to check) before confirming it passes against the fix.
    - The preview modal's Network rendered nothing (blank canvas) despite
      correct-looking data and positions — traced to a classic flexbox
      feedback loop: `.modal-graph { flex: 1 }` had no `min-height: 0`, so it
      fought with vis-network sizing its wrapper to the parent's height,
      and the container never settled on a size (confirmed via Playwright:
      `locator.screenshot()` timed out with "element is not stable" — its
      height was still changing seconds after render). Fixed with
      `min-height: 0`; also deferred the preview's `Network` construction to
      `requestAnimationFrame` so it measures a settled layout even in
      general, not just after this specific fix.
- Follow-up polish on the module overview, from actually using it:
  - **Highlighted edges are now visibly thicker** (`width: 3` vs the default
    `1`), not just a different color — on an overview with lots of crossing
    lines, blue-on-mixed-colors wasn't reading as clearly "highlighted" as a
    bolder line does. Verified the underlying color logic was already
    correct first (queried the live `DataSet` directly — all 223
    module-connected edges and all 21 module nodes matched expectations
    for both the dependency-highlight and value-summary cases, zero
    mismatches) before concluding the actual gap was visual prominence, not
    a color bug.
  - **Module preview modal now matches the page's own light/dark theme**
    instead of always being light, mirroring `:root`'s own
    `prefers-color-scheme` pattern in `style.css`.
  - **Added a Truth Table tab to the module preview** — the other half of
    why `groupByModules` existed in the first place (per the original
    plan: module truth tables feeding into Z3, never finished). Builds a
    `ModuleData` payload from the open module's real gates and calls the
    existing `/truth-table` endpoint, rendered as an HTML table with a
    visual divider between input and output columns. Verified live: a
    16-gate/9-input module correctly returns and renders all 512 (2⁹) rows.
    Falls back to an inline message (not a blocking `alert`, since opening
    a tab is passive) if the backend isn't reachable — same static-demo
    caveat as the Solve buttons.
  - The "which internal parts are currently powered" ask was already
    covered by the preview's existing value-based coloring (confirmed
    again with a mixed true/false scenario, not just all-same); no change
    needed there.
