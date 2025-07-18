import type { LogicGateType, LogicGraph } from "../classes";

/**
 * Преобразує тип з текстового в LogicGateType
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

  const [_, totalWiresStr] = lines[0].split(' ');
  const totalWires = parseInt(totalWiresStr);

  const inputConfig = lines[1].split(' ').map(Number);
  const outputConfig = lines[2].split(' ').map(Number);

  // === INPUT wires ===
  // const inputWireIds: string[] = [];
  // let offset = 0;
  // for (let i = 1; i < inputConfig.length; i++) {
  //   const count = inputConfig[i];
  //   for (let j = 0; j < count; j++) {
  //     inputWireIds.push((offset + j).toString());
  //   }
  //   offset += count;
  // }

  
  // const outputCount = outputConfig[1];
  // const outputWireStart = totalWires - outputCount;
  // const outputWireIds = new Set(
    //   Array.from({ length: outputCount }, (_, i) => (outputWireStart + i).toString())
    // );
    
    const inputCount = inputConfig[0]; // 512
    const outputCount = inputConfig[2]; // 256
  
    const inputWireIds = Array.from({ length: inputCount }, (_, i) => i.toString());
    const outputWireStart = totalWires - outputCount;
    const outputWireIds = new Set(
      Array.from({ length: outputCount }, (_, i) => (outputWireStart + i).toString())
    );
    
  // === GATES ===
  let gateIndex = 0;

  for (let i = 3; i < lines.length; i++) {
    const parts = lines[i].split(' ');
    const numInputs = parseInt(parts[0]);
    const numOutputs = parseInt(parts[1]);

    const inputWires = parts.slice(2, 2 + numInputs);
    const outputWires = parts.slice(2 + numInputs, 2 + numInputs + numOutputs);
    const gateType = mapGateType(parts[parts.length - 1]);

    const gateId = `gate_${gateIndex++}`;

    // Додаємо вузол гейта
    graph[gateId] = {
      id: gateId,
      type: gateType,
      inputs: [] // тимчасово, оновимо пізніше
    };

    // Запам’ятовуємо: цей gateId створює ці дроти
    for (const wire of outputWires) {
      if (wireProducers[wire]) {
        throw new Error(`Wire ${wire} already has a producer (${wireProducers[wire]})`);
      }
      wireProducers[wire] = gateId;
    }

    // Тимчасово зберігаємо input wires
    (graph[gateId] as any).rawInputs = inputWires;
  }

  // === Прив'язуємо входи гейтів ===
  for (const node of Object.values(graph)) {
    const rawInputs: string[] = (node as any).rawInputs || [];

    node.inputs = rawInputs.map(wire => {
      const producer = wireProducers[wire];
      if (producer) return producer;

      // Якщо дріт не має джерела — це зовнішній вхід
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

  // === Додаємо OUTPUT вузли ===
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

