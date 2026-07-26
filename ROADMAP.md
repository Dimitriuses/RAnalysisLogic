# Roadmap

Outstanding work for RAnalysisLogic. The core is functional and the code has been
cleaned up (see [Done](#done)); most of what remains is about making the project
legible and credible to a visitor, plus a few research directions.

Priorities: **High** = portfolio impact, **Medium** = quality & credibility,
**Low** = optional polish.

## Medium priority — quality & credibility

- [ ] **Parser regression test.** Lock in the recent header-format fix: assert that
  both layouts parse to the declared gate count — the old Bristol 2-line header
  (`sha256.txt`, 116246 gates) and the Bristol Fashion 3-line header
  (`64 Bit Adder.txt`, 314 gates) — and that output wires all resolve to a
  producer (no phantom inputs).
- [ ] **Backend test.** A small pytest for `/truth-table` and `/solve` against the
  64-bit adder.
- [ ] **Minimal CI** (GitHub Actions): `tsc --noEmit` for the frontend and
  `py_compile` (or `ruff`) for the backend, so the green check is public.
- [ ] **Clean up dead/debug code.** Commented-out scaffolding and stray
  `console.log`s remain across `logic-sim/src/main.ts`, `logic-sim/src/tools.ts`,
  and `PyZ3Server/solver.py`. Notably, `computeNodeLevels` in
  `logic-sim/src/tools.ts` has a `console.log` inside a hot DFS loop.
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
