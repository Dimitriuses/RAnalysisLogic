# Roadmap

Outstanding work for RAnalysisLogic. The core is functional and the code has been
cleaned up (see [Done](#done)); most of what remains is about making the project
legible and credible to a visitor, plus a few research directions.

Priorities: **High** = portfolio impact, **Medium** = quality & credibility,
**Low** = optional polish.

## Medium priority — quality & credibility

- [ ] **Visualizer doesn't scale past small circuits.** `drawGraph`'s hierarchical
  layout (`direction: 'UD'`) places nodes by topological depth via
  `computeNodeLevelsFast`. For `64 Bit Adder.txt`, the ripple-carry chain is
  ~250 levels deep, so it renders as a long, confusing vertical column, and
  same-level `INPUT`/`OUTPUT` nodes aren't ordered by wire number, so they
  don't visually group by which bit of A/B/sum they are. The default 4-bit
  adder stays small enough to avoid this, so it's not blocking the demo, but
  worth fixing before pointing anyone at a bigger circuit — e.g. sort
  same-level nodes by wire number, or use a more compact/horizontal layout for
  deep circuits.

## Low priority — optional polish

- [ ] **Remove `logic-sim/src/shared/logic-graph1.json`** (2 KB) if it's an unused
  sample.

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
