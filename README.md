# RAnalysisLogic

A boolean logic circuit visualizer, simulator, and SAT-based solver, built with the long-term goal of analyzing **SHA-256** as a boolean circuit and exploring a **collision attack** against it.

> **Status: unfinished / experimental.** The circuit visualizer and simulator work well on arbitrary circuits. The SAT-solving backend works on small-to-medium circuits. The original goal — using it to actually find SHA-256 collisions — is not implemented; the full SHA-256 circuit is far too large (116k+ gates) for the current brute-force solving approach to handle.

## What this is

The idea: represent a hash function as a plain boolean circuit (AND/OR/XOR/NOT/NAND/NOR gates), then use a SAT solver to ask questions like "which inputs produce this output?" or "do two different inputs produce the same output?" (a collision). This repo is the tooling built toward that goal — a circuit loader/visualizer/simulator on the frontend, and a Z3-backed solver on the backend — exercised so far on a 64-bit adder and on a full SHA-256 circuit.

## Structure

- **`logic-sim/`** — TypeScript + Vite frontend.
  - Parses circuit files in **Bristol Fashion** format (gate count, wire count, input/output wire ranges, then a gate list — the standard format used in MPC/garbled-circuit research).
  - Renders the circuit as an interactive graph ([vis-network](https://github.com/visjs/vis-network)): click an `INPUT` node to flip its bit and watch values propagate; click an `OUTPUT` node to highlight which inputs it actually depends on.
  - Simulates the circuit fully client-side.
  - Can group the circuit into smaller sub-modules for local truth-table inspection.
  - Sends a circuit to the backend solver with either the inputs or the outputs fixed, to search for satisfying assignments.
- **`PyZ3Server/`** — FastAPI + [Z3](https://github.com/Z3Prover/z3) backend.
  - Converts a circuit into Z3 boolean formulas.
  - `POST /solve` — enumerates up to 1000 satisfying models for a circuit (given fixed inputs or fixed outputs).
  - `POST /truth-table` — brute-force truth table for a small circuit module.

## Sample circuits

- `logic-sim/src/shared/64 Bit Adder.txt` — small, loads instantly, good for exercising the UI and the solver end-to-end.
- `logic-sim/src/shared/sha256.txt` — the actual target: the SHA-256 compression function as a Bristol Fashion circuit (512-bit message block in, 256-bit digest out, ~116,246 gates). Loads and simulates, but is too large to render smoothly or to solve in full with the current solver.

## Running it

**Frontend**
```bash
cd logic-sim
npm install
npm run dev
```
Opens on `http://localhost:5173`. Upload a circuit file with the file picker, or use the hardcoded 4-bit adder that loads by default.

**Backend**
```bash
cd PyZ3Server
python -m venv .venv
.venv/Scripts/activate   # or source .venv/bin/activate
pip install fastapi uvicorn "z3-solver" tqdm pydantic
uvicorn PyZ3Server.server:app --reload
```
Runs on `http://localhost:8000`. CORS is currently only configured for `http://localhost:5173`.

## Known limitations

- `/solve` enumerates models by repeatedly asking Z3 for a satisfying assignment and then blocking it, capped at 1000 — it does not scale to a 116k-gate circuit.
- There's no collision-search logic yet (e.g. modeling two circuit instances sharing an output and asking Z3 for differing inputs) — that's the natural next step toward the original goal.
- `/truth-table` is brute-force (`2^n` input combinations) and only practical for small modules.
