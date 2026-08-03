# Known issues

Measured, reproducible defects and limits. Everything here has been observed on
the current code, not inferred. Forward plans live in [`ROADMAP.md`](ROADMAP.md).

## 1. `sha256.txt` cannot be rendered

**Status:** blocked in a dependency, diagnosed to the line.

Uploading `logic-sim/src/shared/sha256.txt` (116,246 gates / 117,014 nodes)
throws `Maximum call stack size exceeded` from inside **vis-network's own**
bundled hierarchical-layout code (`crawler`), which walks the ~117k-node flat
render recursively.

This project's own code on the same file is fine and fast:

| Stage | Time |
|---|---|
| parse | ~1.5 s |
| level assignment | ~1.7 s |
| `groupByModules` | ~2.1 s (24,042 modules) |
| `simulateGraph` | 571 ms (116,996 of 117,014 nodes valued) |
| `findDependenciesForOutput` (deep output) | 236 ms (115,720 deps) |

The 18 unvalued nodes are `NOT` gates with zero consumers — dead code in the
circuit file itself, confirmed against a reverse-dependency index, and equally
unreached by the older recursive implementation.

Fixing this means either disabling hierarchical layout above a node-count
threshold or writing a non-recursive layout; being legible at that scale is a
separate problem from not crashing. Because it can't render, the file is **not**
bundled into the hosted demo.

## 2. The solver does not scale to a full hash circuit

`/solve` enumerates models by repeatedly asking Z3 for an assignment and then
adding a blocking clause, capped at `MAX_MODELS = 1000` (`solver.py`). That is
fine for the sample adders and hopeless for 116k gates — which is exactly why
the project's original goal (SHA-256 collision search) is still open. When the
cap is hit the response is silently truncated rather than flagged as partial.

## 3. `/truth-table` is unguarded brute force

The endpoint evaluates all `2^n` combinations for a module's `n` boundary
inputs, with no cap and no warning in the UI.

Measured on the bundled 64-bit adder: **all 21 modules have 9 boundary inputs**
(512 rows each, ~1 s round trip). Note that this exceeds `groupByModules`'
nominal `maxModuleSize = 8` — the limit is tested against the group *before* the
next node is appended, so a group reliably ends up one node past it. A circuit
that produced wider modules would grow the table exponentially with no guard.

## 4. The frontend and the backend disagree about where they run

`server.py` hardcodes CORS to `http://localhost:5173` (the Vite **dev** server).
A production build served from anywhere else — including `vite preview` on
:4173, or the GitHub Pages demo — cannot call the backend. This is why:

- the end-to-end smoke test (`npm run smoke`) exercises only the client-side
  visualizer/simulator, and
- **Solve**, **Solve (fix outputs)** and the module **Truth Table** tab show a
  plain-language disclaimer on the hosted demo instead of a result.

Run the frontend with `npm run dev` to use the solver locally.

## 5. The backend is a local tool, not a service

No authentication, no TLS, no rate limiting, no request size limit, and
`allow_credentials=True` alongside a permissive method/header policy. A `/solve`
request is unbounded work on the server's CPU. Run it on localhost only; it is
not written to be exposed.

## 6. Module overview layout is functional, not pretty

`assignOverviewLevels` re-anchors each `INPUT` next to the earliest module that
consumes it, which stops all 128 inputs piling onto one row, but the result is
still a wide block of input boxes down the left-hand side rather than a compact
diagram. Legible; not a schematic.

## 7. Circuit support is narrower than the format allows

The parser handles `XOR`/`AND`/`OR`/`INV`/`NAND`/`NOR` with the wire-numbering
conventions used by the Bristol collection. Gates with more than two inputs are
accepted by the simulator (which folds over all of them) but the Z3 backend only
reads the first two operands, so a >2-input gate would be solved incorrectly.
Neither shipped sample contains one.

## 8. No collision search

The original goal — modelling two circuit instances that share an output and
asking Z3 for differing inputs — is not implemented. See
[`ROADMAP.md`](ROADMAP.md).
