import type { LogicGateType, LogicGraph } from "../classes";

/**
 * Преобразує тип з текстового в LogicGateType
 */
function mapGateType(rawType: string): LogicGateType {
  switch (rawType.toUpperCase()) {
    case 'XOR': return 'XOR';
    case 'AND': return 'AND';
    case 'OR': return 'OR';
    case 'NOT': return 'NOT';
    case 'NAND': return 'NAND';
    case 'NOR': return 'NOR';
    default: throw new Error(`Unknown gate type: ${rawType}`);
  }
}

// export function parseCircuitFile(content: string): LogicGraph {
//   const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

//   const logicGraph: LogicGraph = {};

//   // Парсимо заголовок
//   const [numGates, totalWires] = lines[0].split(' ').map(Number);
//   const inputConfig = lines[1].split(' ').map(Number); // e.g., [2, 64, 64]
//   const outputConfig = lines[2].split(' ').map(Number); // e.g., [1, 64]

//   // === INPUT NODES ===
//   const inputCount = inputConfig.slice(1).reduce((a, b) => a + b, 0);
//   const inputIds: number[] = [];
//   let offset = 0;
//   for (let i = 1; i < inputConfig.length; i++) {
//     const count = inputConfig[i];
//     for (let j = 0; j < count; j++) {
//       const wireId = offset + j;
//       inputIds.push(wireId);
//       logicGraph[wireId.toString()] = {
//         id: wireId.toString(),
//         type: 'INPUT',
//         inputs: [],
//       };
//     }
//     offset += count;
//   }

//   // === OUTPUT IDS ===
//   const outputCount = outputConfig[1];
//   const outputStart = parseInt(totalWires.toString()) - outputCount;
//   const outputIds = Array.from({ length: outputCount }, (_, i) => outputStart + i);

//   // === GATES ===
//   for (let i = 3; i < lines.length; i++) {
//     const parts = lines[i].split(' ');
//     const numInputs = parseInt(parts[0]);
//     const numOutputs = parseInt(parts[1]);
//     const inputIds = parts.slice(2, 2 + numInputs).map(s => s.trim());
//     const outputIds = parts.slice(2 + numInputs, 2 + numInputs + numOutputs).map(s => s.trim());
//     const gateTypeRaw = parts[parts.length - 1];

//     const gateType = mapGateType(gateTypeRaw);

//     for (const outputId of outputIds) {
//       logicGraph[outputId] = {
//         id: outputId,
//         type: gateType,
//         inputs: inputIds,
//       };
//     }
//   }

//   // === OUTPUT NODES ===
//   for (const outputId of outputIds) {
//     if (!(outputId.toString() in logicGraph)) {
//       // Створимо окрему OUTPUT ноду, яка бере сигнал з попереднього
//       logicGraph[outputId.toString()] = {
//         id: outputId.toString(),
//         type: 'OUTPUT',
//         inputs: [outputId.toString()], // типова "перепідключка"
//       };
//     } else {
//       // Змінимо тип, якщо вже є вузол на тому дроті
//       logicGraph[outputId.toString()].type = 'OUTPUT';
//     }
//   }

//   // for (const outputId of outputIds) {
//   // const key = outputId.toString();
//   // if (logicGraph[key]) {
//   //     // Якщо вже є — просто переопреділяємо тип
//   //     logicGraph[key].type = 'OUTPUT';
//   //   } else {
//   //     throw new Error(`OUTPUT node ${outputId} не має джерела!`);
//   //   }
//   // }

//   return logicGraph;
// }

// export function parseCircuitFile(content: string): LogicGraph {
//   const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
//   const graph: LogicGraph = {};

//   const [_, totalWires] = lines[0].split(' ').map(Number);
//   const inputInfo = lines[1].split(' ').map(Number);
//   const outputInfo = lines[2].split(' ').map(Number);

//   const inputIds: number[] = [];
//   let offset = 0;
//   for (let i = 1; i < inputInfo.length; i++) {
//     const count = inputInfo[i];
//     for (let j = 0; j < count; j++) {
//       const id = offset + j;
//       inputIds.push(id);
//       graph[id.toString()] = { id: id.toString(), type: 'INPUT', inputs: [] };
//     }
//     offset += count;
//   }

//   const outputCount = outputInfo[1];
//   const outputStart = totalWires - outputCount;
//   const outputWireIds = new Set(
//     Array.from({ length: outputCount }, (_, i) => outputStart + i)
//   );

//   const wireToGateOutput: Record<string, string> = {}; // 378 → "gate_0"
//   const wireConsumers: Record<string, string[]> = {}; // wire → [gate ids]

//   for (let i = 3; i < lines.length; i++) {
//     const parts = lines[i].split(' ');
//     const numInputs = parseInt(parts[0]);
//     const numOutputs = parseInt(parts[1]);
//     const inputWires = parts.slice(2, 2 + numInputs);
//     const outputWires = parts.slice(2 + numInputs, 2 + numInputs + numOutputs);
//     const gateType = parts[parts.length - 1] as LogicGateType;

//     const gateId = `${i - 3}`;
//     graph[gateId] = {
//       id: gateId,
//       type: gateType,
//       inputs: inputWires
//     };

//     for (const outWire of outputWires) {
//       wireToGateOutput[outWire] = gateId;
//     }

//     for (const inWire of inputWires) {
//       if (!wireConsumers[inWire]) wireConsumers[inWire] = [];
//       wireConsumers[inWire].push(gateId);
//     }
//   }

//   // Створюємо OUTPUT вузли
//   for (const wireId of outputWireIds) {
//     const producerGateId = wireToGateOutput[wireId.toString()];
//     if (!producerGateId) {
//       throw new Error(`OUTPUT wire ${wireId} не має жодного джерела`);
//     }

//     const outNodeId = `${wireId}`;
//     graph[outNodeId] = {
//       id: outNodeId,
//       type: 'OUTPUT',
//       inputs: [producerGateId]
//     };
//   }

//   return graph;
// }

export function parseCircuitFile(content: string): LogicGraph {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  const graph: LogicGraph = {};
  const wireProducers: Record<string, string> = {}; // wire → producer gate ID

  const [_, totalWiresStr] = lines[0].split(' ');
  const totalWires = parseInt(totalWiresStr);

  const inputConfig = lines[1].split(' ').map(Number);
  const outputConfig = lines[2].split(' ').map(Number);

  // === INPUT wires ===
  const inputWireIds: string[] = [];
  let offset = 0;
  for (let i = 1; i < inputConfig.length; i++) {
    const count = inputConfig[i];
    for (let j = 0; j < count; j++) {
      inputWireIds.push((offset + j).toString());
    }
    offset += count;
  }

  const outputCount = outputConfig[1];
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

