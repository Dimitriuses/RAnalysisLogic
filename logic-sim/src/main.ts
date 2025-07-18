import './style.css'
// import typescriptLogo from './typescript.svg'
// import viteLogo from '/vite.svg'
// import { setupCounter } from './counter.ts'
import { Network, type Node, type Edge, type Options } from 'vis-network';
import { DataSet } from 'vis-data';
import type { LogicNode, LogicGraph } from './classes.ts';
import { findDependenciesForOutput, generateInputs, getOutputs, settupInputs, simulateGraph } from './logic.ts';
import { graph4bitAdder, inputValues4bitAdder } from './graphs.ts';
import { computeNodeLevels, computeNodeLevelsTopological } from './tools.ts';
import { parseCircuitFile } from './shared/parcer.ts';

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
let inputIds: string[] = [];
let outputIds: string[] = [];

let graph: LogicGraph;
let inputValues: Record<string, boolean> = {};


function updateColors(values: Record<string, boolean>, nodeList: DataSet<Node>, edgeList: DataSet<Edge>, relevantInputs?: Set<string> ) {
  const updated = Object.entries(values).map(([id, value]) => ({
    id,
    color: { 
      background: relevantInputs?.has(id)? '#7779ffff' : (value ? '#a0f0a0' : '#f0a0a0'),
      // border: relevantInputs?.has(id)? '#7779ffff' : '#ffffff'
    },

  }));
  nodeList.update(updated);

  const updatedEdges = edgeList.get().map(edge => {
    const id = edge.from as string
    const idt = edge.to as string
    const fromVal = values[id];
    return {
      id: edge.id,
      color: { color: relevantInputs?.has(idt)? '#0300ccff' : (fromVal ? '#00cc00' : '#cc0000') }, // Зелений = 1, Червоний = 0
      arrows: 'to'
    };
  });

  edgeList.update(updatedEdges);
}

function drawGraph(graph: Record<string, LogicNode>, inputValues: Record<string, boolean>) {
  // const levels = computeNodeLevelsTopological(graph);
  // const levels = computeNodeLevels(graph);

  const nodesArray: Node[] = Object.values(graph).map(n => ({
    id: n.id,
    label: (n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id),
    shape: 'box',
    color: { background: '#f0a0a0' },
    // level: levels[n.id]
  }));

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

  const options: Options = {
    physics: false,
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD', 
        sortMethod: 'directed',
        levelSeparation: 40,
        nodeSpacing: 80,
      }
    },
    edges: {
      smooth: false 
    }
  };

  const network = new Network(container, { nodes, edges }, options); // 'vis-network'
  let relevantInputsPerOutput: Record<string, Set<string>> = {};

  network.on('click', function (params) {
    if (params.nodes.length > 0) {
      const id = params.nodes[0];
      if (graph[id]?.type === 'INPUT') {
        inputValues[id] = !inputValues[id];
        const result = simulateGraph(graph, inputValues);
        updateColors(result, nodes, edges);
        updateBitOutputDisplay(getOutputs(graph, result))
      }
      if (graph[id]?.type === "OUTPUT") {
        const deps = findDependenciesForOutput(graph, id);
        // relevantInputsPerOutput[id] = new Set(
        //   Array.from(deps).filter(id => graph[id].type === "INPUT")
        // );
        relevantInputsPerOutput[id] = deps
        // console.log(relevantInputsPerOutput);
        updateColors(result, nodes, edges, relevantInputsPerOutput[id]);
      }
    }
  });

  const result = simulateGraph(graph, inputValues);
  // console.log(result)
  updateColors(result, nodes, edges);
  updateBitOutputDisplay(getOutputs(graph, result))
}

inputValues = generateInputs(graph4bitAdder)
graph = graph4bitAdder

drawGraph(graph, inputValues);

fileInput.addEventListener('change', (event) => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    const graph = parseCircuitFile(text);
    console.log(generateInputs(graph))
    console.log('Parsed graph:', Object.keys(graph).length);
    // console.log(graph)
    drawGraph(graph, generateInputs(graph))
    // const blob = new Blob([JSON.stringify(graph)], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'logic-graph.json';
    // a.click();
  };
  reader.readAsText(file);
});

document.getElementById('fileInput')!.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const text = await file.text();
  graph = parseCircuitFile(text);

  inputIds = Object.values(graph).filter(n => n.type === 'INPUT').map(n => n.id).sort();
  outputIds = Object.values(graph).filter(n => n.type === 'OUTPUT').map(n => n.id).sort();

  // ініціалізуємо всі input як false
  inputValues = {};
  for (const id of inputIds) {
    inputValues[id] = false;
  }

  updateBitInputDisplay();
  drawGraph(graph, inputValues);
});

function updateBitInputDisplay() {
  const bitStr = inputIds.map(id => (inputValues[id] ? '1' : '0')).join('');
  (document.getElementById('bitInput') as HTMLInputElement).value = bitStr;
}

function updateBitOutputDisplay(outputs: Record<string, boolean>) {
  const bitStr = Object.values(outputs).map(value => { return value ? '1' : '0' }).join('');
  // console.log(bitStr);
  (document.getElementById('bitOutput') as HTMLInputElement).value = bitStr;
}

// Set Inputs from bit string
document.getElementById('applyInputs')!.addEventListener('click', () => {
  const val = (document.getElementById('bitInput') as HTMLInputElement).value.trim();
  for (let i = 0; i < inputIds.length && i < val.length; i++) {
    inputValues[inputIds[i]] = val[i] === '1';
  }
  // updateBitInputDisplay();
  inputValues = settupInputs(inputValues, val)
  drawGraph(graph, inputValues)
});

// Run simulation and update output field
document.getElementById('downloadBtn')!.addEventListener('click', () => {
  if (!graph) return;
  // const result = simulateGraph(graph, inputValues);
  // updateBitOutputDisplay(result);
  const data = {
    inputs: Object.values(graph).filter(v => v.type == "INPUT").map(v => v.id),
    outputs: Object.values(graph).filter(v => v.type == "OUTPUT").map(v => v.id),
    gates: Object.values(graph)
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'logic-graph2.json';
  a.click();
});


// fileInput.addEventListener('click', () => {
//   console.log('Клік по input відбувся!');
// });


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
