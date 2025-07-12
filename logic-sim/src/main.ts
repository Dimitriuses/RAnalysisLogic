import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'
import { Network, type Node, type Edge } from 'vis-network';
import { DataSet } from 'vis-data';

// document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
//   <div>
//     <a href="https://vite.dev" target="_blank">
//       <img src="${viteLogo}" class="logo" alt="Vite logo" />
//     </a>
//     <a href="https://www.typescriptlang.org/" target="_blank">
//       <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
//     </a>
//     <h1>Vite + TypeScript</h1>
//     <div class="card">
//       <button id="counter" type="button"></button>
//     </div>
//     <p class="read-the-docs">
//       Click on the Vite and TypeScript logos to learn more
//     </p>
//   </div>
// `

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)


// document.querySelector<HTMLDivElement>('#app')!.innerHTML =`
// <div id="network"></div>
// `


type LogicGateType = 'INPUT' | 'OUTPUT' | 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR';

interface LogicNode {
  id: string;
  level?: number
  type: LogicGateType;
  inputs: string[];
  value?: boolean;
}

type LogicGraph = Record<string, LogicNode>;


function simulateGraph(graph: LogicGraph, inputValues: Record<string, boolean>): Record<string, boolean> {
  const values: Record<string, boolean> = {};

  // Допоміжна функція для рекурсивного обчислення
  function evaluate(id: string): boolean {
    if (id in values) return values[id];

    const node = graph[id];
    if (!node) throw new Error(`Unknown node ID: ${id}`);

    let result: boolean;

    switch (node.type) {
      case 'INPUT':
        if (!(id in inputValues)) throw new Error(`Missing input value for ${id}`);
        result = inputValues[id];
        break;

      case 'AND':
        result = node.inputs.every(inputId => evaluate(inputId));
        break;

      case 'OR':
        result = node.inputs.some(inputId => evaluate(inputId));
        break;

      case 'NOT':
        if (node.inputs.length !== 1) throw new Error(`NOT gate ${id} must have exactly one input`);
        result = !evaluate(node.inputs[0]);
        break;

      case 'XOR':
        result = node.inputs.reduce((acc, inputId) => acc !== evaluate(inputId), false);
        break;

      case 'NAND':
        result = !node.inputs.every(inputId => evaluate(inputId));
        break;

      case 'NOR':
        result = !node.inputs.some(inputId => evaluate(inputId));
        break;

      case 'OUTPUT':
        if (node.inputs.length !== 1) throw new Error(`OUTPUT node ${id} must have one input`);
        result = evaluate(node.inputs[0]);
        break;

      default:
        throw new Error(`Unsupported gate type: ${node.type}`);
    }

    values[id] = result;
    return result;
  }

  // Обчислюємо всі вузли типу OUTPUT
  for (const id in graph) {
    if (graph[id].type === 'OUTPUT') {
      evaluate(id);
    }
  }

  return values;
}

function updateColors(values: Record<string, boolean>, nodeList: DataSet<Node>, edgeList: DataSet<Edge>) {
  const updated = Object.entries(values).map(([id, value]) => ({
    id,
    color: { background: value ? '#a0f0a0' : '#f0a0a0' }
  }));
  nodeList.update(updated);

  const updatedEdges = edgeList.get().map(edge => {
    const fromVal = values[edge.from as string];
    return {
      id: edge.id,
      color: { color: fromVal ? '#00cc00' : '#cc0000' }, // Зелений = 1, Червоний = 0
      arrows: 'to' // Додатково можна вмикати стрілку
    };
  });

  edgeList.update(updatedEdges);
}

// function computeNodeLevels(graph: Record<string, LogicNode>): Record<string, number> {
//   const levels: Record<string, number> = {};

//   function dfs(nodeId: string): number {
//     if (levels[nodeId] !== undefined) return levels[nodeId];

//     const node = graph[nodeId];
//     if (!node) return 0;

//     if (node.inputs.length === 0) {
//       levels[nodeId] = 0;
//     } else {
//       levels[nodeId] = Math.max(...node.inputs.map(dfs)) + 1;
//     }

//     return levels[nodeId];
//   }

//   for (const id of Object.keys(graph)) {
//     dfs(id);
//   }

//   return levels;
// }

function computeNodeLevels(graph: Record<string, LogicNode>): Record<string, number> {
  const levels: Record<string, number> = {};
  const visited = new Set<string>();

  function dfs(nodeId: string, depth: number): void {
    if (levels[nodeId] === undefined || depth > levels[nodeId]) {
      levels[nodeId] = depth;
    }

    visited.add(nodeId);

    for (const outputId of Object.keys(graph)) {
      const output = graph[outputId];
      if (output.inputs.includes(nodeId)) {
        dfs(outputId, depth + 1);
      }
    }
  }

  // Стартуємо з усіх вузлів, які не мають inputs (входи)
  for (const node of Object.values(graph)) {
    if (node.inputs.length === 0) {
      dfs(node.id, 0);
    }
  }

  return levels;
}

function computeNodeLevelsTopological(graph: Record<string, LogicNode>): Record<string, number> {
  const levels: Record<string, number> = {};
  const inDegree: Record<string, number> = {};
  const dependents: Record<string, string[]> = {};

  // 1. Підрахунок вхідних ребер (in-degree)
  for (const node of Object.values(graph)) {
    inDegree[node.id] = node.inputs.length;
    for (const input of node.inputs) {
      if (!dependents[input]) {
        dependents[input] = [];
      }
      dependents[input].push(node.id);
    }
  }

  // 2. Черга вузлів без входів (вхідні вузли)
  const queue: string[] = Object.keys(graph).filter(id => inDegree[id] === 0);

  // 3. Ітеративна обробка вузлів у порядку "спочатку залежності"
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = graph[id];

    // Визначення рівня: max(всі level входів) + 1
    if (node.inputs.length === 0) {
      levels[id] = 0;
    } else {
      levels[id] = Math.max(...node.inputs.map(input => levels[input])) + 1;
    }

    // Оновлення залежних вузлів
    for (const dependentId of dependents[id] || []) {
      inDegree[dependentId]--;
      if (inDegree[dependentId] === 0) {
        queue.push(dependentId);
      }
    }
  }

  const maxLevel = Math.max(...Object.values(levels))

  for (const node of Object.values(graph)) {
    if (node.type === "OUTPUT") {
      levels[node.id] = maxLevel;
    }
  }

  return levels;
}

const graph: LogicGraph = {
  A1: { id: "A1", level: 0, type: "INPUT", inputs: []},
  A2: { id: "A2", level: 0, type: "INPUT", inputs: []},
  A3: { id: "A3", level: 0, type: "INPUT", inputs: []},
  A4: { id: "A4", level: 0, type: "INPUT", inputs: []},

  B1: { id: "B1", level: 0, type: "INPUT", inputs: []},
  B2: { id: "B2", level: 0, type: "INPUT", inputs: []},
  B3: { id: "B3", level: 0, type: "INPUT", inputs: []},
  B4: { id: "B4", level: 0, type: "INPUT", inputs: []},

  CIN: { id: "CIN", level: 0, type: "INPUT", inputs: []},

  S1X1: { id: "S1X1", type: "XOR", inputs: ["A1", "B1"]},
  S1X2: { id: "S1X2", type: "XOR", inputs: ["S1X1", "CIN"]},
  S1A1: { id: 'S1A1', type: 'AND', inputs: ["A1", "B1"]},
  S1A2: { id: 'S1A2', type: 'AND', inputs: ["S1X1", "CIN"]},
  S1R1: { id: 'S1R1', type: 'OR', inputs: ["S1A1", "S1A2"]},

  S2X1: { id: "S2X1", type: "XOR", inputs: ["A2", "B2"]},
  S2X2: { id: "S2X2", type: "XOR", inputs: ["S2X1", "S1R1"]},
  S2A1: { id: 'S2A1', type: 'AND', inputs: ["A2", "B2"]},
  S2A2: { id: 'S2A2', type: 'AND', inputs: ["S2X1", "S1R1"]},
  S2R1: { id: 'S2R1', type: 'OR', inputs: ["S2A1", "S2A2"]},

  S3X1: { id: "S3X1", type: "XOR", inputs: ["A3", "B3"]},
  S3X2: { id: "S3X2", type: "XOR", inputs: ["S3X1", "S2R1"]},
  S3A1: { id: 'S3A1', type: 'AND', inputs: ["A2", "B2"]},
  S3A2: { id: 'S3A2', type: 'AND', inputs: ["S3X1", "S2R1"]},
  S3R1: { id: 'S3R1', type: 'OR', inputs: ["S3A1", "S3A2"]},

  S4X1: { id: "S4X1", type: "XOR", inputs: ["A4", "B4"]},
  S4X2: { id: "S4X2", type: "XOR", inputs: ["S4X1", "S3R1"]},
  S4A1: { id: 'S4A1', type: 'AND', inputs: ["A4", "B4"]},
  S4A2: { id: 'S4A2', type: 'AND', inputs: ["S4X1", "S3R1"]},
  S4R1: { id: 'S4R1', type: 'OR', inputs: ["S4A1", "S4A2"]},

  OUT1: { id: 'OUT1', type: 'OUTPUT', inputs: ['S1X2'] },
  OUT2: { id: 'OUT2', type: 'OUTPUT', inputs: ['S2X2'] },
  OUT3: { id: 'OUT3', type: 'OUTPUT', inputs: ['S3X2'] },
  OUT4: { id: 'OUT4', type: 'OUTPUT', inputs: ['S4X2'] },
  COUT: { id: 'COUT', type: 'OUTPUT', inputs: ['S4R1'] },

};

let inputValues: Record<string, boolean> = { A1: false, A2: false, A3: false, A4: false, B1: false, B2: false, B3: false, B4: false, CIN: false };

function main() {
  const levels = computeNodeLevelsTopological(graph);

  const nodesArray: Node[] = Object.values(graph).map(n => ({
    id: n.id,
    label: (n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id),
    shape: 'box',
    color: { background: '#f0a0a0' },
    level: levels[n.id]
  }));

  // const nodesArray: Node[] = Object.values(graph).map(n => {
  //   const base: Node = {
  //     id: n.id,
  //     label: (n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id),
  //     shape: 'box',
  //     color: { background: '#f0a0a0' },
  //     level: n.level
  //   };
  //   // if (n.level !== undefined) {
  //   //   (base as any).level = n.level;
  //   // }
  //   return base;
    
  // });

  //console.log(nodesArray)

  const edgesArray: Edge[] = Object.values(graph).flatMap(n =>
    n.inputs.map(input => ({
      id: `${input}->${n.id}`,
      from: input,
      to: n.id,
      smooth: false
    }))
  );

  const container = document.getElementById('app')!;
  const nodes = new DataSet<Node>(nodesArray);
  const edges = new DataSet<Edge>(edgesArray);

  const options = {
    physics: false,
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD', // або 'UD' (up-down)
        sortMethod: 'directed',
        levelSeparation: 40,
        nodeSpacing: 80,
      }
    },
    edges: {
      smooth: false // 🔧 обов’язково для прямих ліній
    }
  };

  const network = new Network(container, { nodes, edges }, options);

  network.on('click', function (params) {
    if (params.nodes.length > 0) {
      const id = params.nodes[0];
      if (graph[id]?.type === 'INPUT') {
        inputValues[id] = !inputValues[id];
        const result = simulateGraph(graph, inputValues);
        updateColors(result, nodes, edges);
      }
    }
  });

  const result = simulateGraph(graph, inputValues);
  updateColors(result, nodes, edges);
}
main();


// const graph: LogicGraph = {
//   A: { id: 'A', type: 'INPUT', inputs: [] },
//   B: { id: 'B', type: 'INPUT', inputs: [] },
//   N1: { id: 'N1', type: 'AND', inputs: ['A', 'B'] },
//   N2: { id: 'N2', type: 'NOT', inputs: ['N1'] },
//   OUT: { id: 'OUT', type: 'OUTPUT', inputs: ['N2'] }
// };



// const result = simulateGraph(graph, { A: true, B: false });
// const input = { A1: false, A2: true, B1: true, B2: true, CIN: false}
// console.log(input)

// const result = simulateGraph(sumator, input);

// console.log({ S1: result.OUT1, S2: result.OUT2, CARRY: result.COUT}); 
