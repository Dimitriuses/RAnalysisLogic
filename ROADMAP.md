# Roadmap

Outstanding work for RAnalysisLogic. The core is functional and the code has been
cleaned up (see [Done](#done)); most of what remains is about making the project
legible and credible to a visitor, plus a few research directions.

Priorities: **High** = portfolio impact, **Medium** = quality & credibility,
**Low** = optional polish.

## High priority — portfolio impact

- [ ] **Screenshots / GIF in the README.** This is a visual project with no images
  yet — the biggest gap. Capture the circuit graph with colored wires, flipping an
  `INPUT` bit and watching values propagate, and the `OUTPUT`-dependency
  highlighting. A short GIF of the 64-bit adder is enough.
- [ ] **Live demo via GitHub Pages.** Visualization, simulation, and
  dependency-highlighting are all client-side and the app loads the hardcoded
  4-bit adder by default, so a Pages build is instantly usable. Caveat: the
  **Solve / Truth-table** buttons need the local FastAPI backend
  (`localhost:8000`) — either guard them to show a "requires local backend" note
  when it's unreachable, or say so clearly in the UI/README.
- [ ] **Add `PyZ3Server/requirements.txt`** (`fastapi`, `uvicorn`, `z3-solver`,
  `tqdm`, `pydantic`). The README currently inlines the pip list; a requirements
  file is the conventional, copy-pasteable form.
- [ ] **Add a LICENSE** (MIT, to match `brickwork-ssg`).

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
