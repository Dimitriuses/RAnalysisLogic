import type { LogicGateType, LogicGraph } from "../classes";

/**
 * Maps a textual gate type to a LogicGateType.
 */
function mapGateType(rawType: string): LogicGateType {
  switch (rawType.toUpperCase()) {
    case 'XOR': return 'XOR';
    case 'AND': return 'AND';
    case 'OR': return 'OR';
    case 'INV': return 'NOT';
    case 'NAND': return 'NAND';
    case 'NOR': return 'NOR';
    default: throw new Error(`Unknown gate type: ${rawType}`);
  }
}

export function parseCircuitFile(content: string): LogicGraph {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  const graph: LogicGraph = {};
  const wireProducers: Record<string, string> = {}; // wire → producer gate ID

  // Line 0: "<num_gates> <num_wires>"
  const totalWires = parseInt(lines[0].split(/\s+/)[1], 10);

  // A gate line ends with a type token (e.g. XOR); a header line is all numbers.
  // Bristol Fashion has two header lines (input sizes, then output sizes); the
  // older Bristol format used by sha256.txt has only one
  // ("<input-wires> <party-2-wires> <output-wires>"). Detect where the gates
  // actually start rather than assuming a fixed offset.
  const isGateLine = (line: string) => Number.isNaN(Number(line.split(/\s+/).pop()));

  let firstGateIndex = 1;
  while (firstGateIndex < lines.length && !isGateLine(lines[firstGateIndex])) {
    firstGateIndex++;
  }
  const headerLines = lines
    .slice(1, firstGateIndex)
    .map(l => l.split(/\s+/).map(Number));

  // Number of output wires:
  //  - Bristol Fashion (2 header lines): last line is "<nov> <size...>" → sum of the sizes.
  //  - Old Bristol (1 header line): "<niw1> <niw2> <now>" → the last value.
  const outputCount =
    headerLines.length >= 2
      ? headerLines[headerLines.length - 1].slice(1).reduce((a, b) => a + b, 0)
      : headerLines[0][headerLines[0].length - 1];

  // Output wires are always the highest-numbered wires in the circuit.
  const outputWireStart = totalWires - outputCount;
  const outputWireIds = new Set(
    Array.from({ length: outputCount }, (_, i) => (outputWireStart + i).toString())
  );

  // === GATES ===
  let gateIndex = 0;

  for (let i = firstGateIndex; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    const numInputs = parseInt(parts[0]);
    const numOutputs = parseInt(parts[1]);

    const inputWires = parts.slice(2, 2 + numInputs);
    const outputWires = parts.slice(2 + numInputs, 2 + numInputs + numOutputs);
    const gateType = mapGateType(parts[parts.length - 1]);

    const gateId = `gate_${gateIndex++}`;

    // Add the gate node
    graph[gateId] = {
      id: gateId,
      type: gateType,
      inputs: [] // temporary; filled in later
    };

    // Record that this gateId produces these wires
    for (const wire of outputWires) {
      if (wireProducers[wire]) {
        throw new Error(`Wire ${wire} already has a producer (${wireProducers[wire]})`);
      }
      wireProducers[wire] = gateId;
    }

    // Temporarily store the input wires
    (graph[gateId] as any).rawInputs = inputWires;
  }

  // === Bind gate inputs ===
  for (const node of Object.values(graph)) {
    const rawInputs: string[] = (node as any).rawInputs || [];

    node.inputs = rawInputs.map(wire => {
      const producer = wireProducers[wire];
      if (producer) return producer;

      // A wire with no producer is an external input
      const inputId = `IN_${wire}`;
      if (!graph[inputId]) {
        graph[inputId] = {
          id: inputId,
          type: 'INPUT',
          inputs: []
        };
      }
      return inputId;
    });

    delete (node as any).rawInputs;
  }

  // === Add OUTPUT nodes ===
  for (const wire of outputWireIds) {
    const fromGate = wireProducers[wire];
    if (!fromGate) {
      throw new Error(`OUTPUT wire ${wire} has no source gate`);
    }

    const outputId = `OUT_${wire}`;
    graph[outputId] = {
      id: outputId,
      type: 'OUTPUT',
      inputs: [fromGate]
    };
  }

  return graph;
}
