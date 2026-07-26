# Roadmap

Outstanding work for RAnalysisLogic. The core is functional and the code has been
cleaned up (see [Done](#done)); most of what remains is about making the project
legible and credible to a visitor, plus a few research directions.

Priorities: **High** = portfolio impact, **Medium** = quality & credibility,
**Low** = optional polish.

## Medium priority — quality & credibility

- [ ] **Clean up dead/debug code.** Commented-out scaffolding and stray
  `console.log`s remain across `logic-sim/src/main.ts`, `logic-sim/src/tools.ts`,
  and `PyZ3Server/solver.py`. Notably, `computeNodeLevels` in
  `logic-sim/src/tools.ts` has a `console.log` inside a hot DFS loop. While
  we're in there: pyupgrade-style modernization of the backend's type hints
  (`typing.Dict`/`List`/`Optional[X]` → the builtin `dict`/`list`/`X | None`
  syntax) — purely cosmetic, so bundled into this housekeeping pass rather
  than given its own item.
- [ ] **Resolve `PyZ3Server/test.py`.** It's a Z3 scratch file, not a real test —
  promote it to a proper test or delete it.
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
