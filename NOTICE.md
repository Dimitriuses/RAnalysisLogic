# Third-party notices

The project's own source is MIT-licensed — see [`LICENSE`](LICENSE). The
following third-party material is redistributed in this repository, or shipped
in the built demo, under its own terms.

## Circuit files

### `logic-sim/src/shared/sha256.txt`

The SHA-256 compression function as a boolean circuit, in the **older "Bristol
format"**, obtained from the public Bristol circuit collection (originally
maintained at the University of Bristol, now by Nigel Smart's group at KU
Leuven):

- <https://homes.esat.kuleuven.be/~nsmart/MPC/>

| | |
|---|---|
| Declared header | `116246 116758` / `512 0 256` — 116,246 gates, 116,758 wires, 512 input wires, 256 output wires |
| Size | 3,135,944 bytes |
| SHA-256 | `66a0af22738c7c05b4e6b98850cee586ee3eacbddee0fad6de9dc9b65b8a8fcb` |

These circuit files are published by their maintainers as a research resource
for multi-party-computation work and are distributed without an explicit
licence file. They are included here only as sample input for the parser, are
not part of this project's own source, and no ownership is claimed over them.
They are **not** bundled into the deployed demo. If you are redistributing this
repository and would rather not carry the file, delete it and re-download it
from the link above — the README's *Generating circuit files* section explains
how, and the parser test suite is the only thing that depends on its presence.

### `logic-sim/src/shared/64-bit-adder.txt`

A 64-bit adder in **Bristol Fashion** format (314 gates, 128 input wires, 64
output wires; SHA-256 `544cd0691a1cd88a631266d67e2184707ff9616658a340b6c6aab7912b75419e`),
from the same collection. This one *is* inlined into the built demo (6.5 KB) so
the hosted visualizer has a circuit deep enough to exercise module-overview
mode without requiring a file upload.

## Runtime dependencies shipped in the demo bundle

| Package | Version | Licence |
|---|---|---|
| [vis-network](https://github.com/visjs/vis-network) | 9.1.13 | Apache-2.0 OR MIT |
| [vis-data](https://github.com/visjs/vis-data) | 7.1.10 | Apache-2.0 OR MIT |

## Backend dependencies (not redistributed)

Installed from PyPI at setup time by `PyZ3Server/requirements.txt`, not vendored
here:

| Package | Licence |
|---|---|
| [z3-solver](https://github.com/Z3Prover/z3) | MIT |
| [FastAPI](https://github.com/fastapi/fastapi) | MIT |
| [Uvicorn](https://github.com/encode/uvicorn) | BSD-3-Clause |
| [Pydantic](https://github.com/pydantic/pydantic) | MIT |

## Assets

`logic-sim/public/favicon.svg` is an original drawing of an AND gate made for
this project; it contains no third-party artwork.
