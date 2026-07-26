import './style.css'
import { Network, type Node, type Edge, type Options } from 'vis-network';
import { DataSet } from 'vis-data';
import type { LogicNode, LogicGraph } from './classes.ts';
import { findDependenciesForOutput, generateInputs, getInputs, getOutputs, settupInputs, simulateGraph } from './logic.ts';
import { graph4bitAdder } from './graphs.ts';
import { computeNodeLevelsFast, groupByModules } from './tools.ts';
import { parseCircuitFile } from './shared/parser.ts';
import { convertGraphToCircuit, sendToSolver } from './shared/shared.ts';


const fileInput = document.getElementById('fileInput') as HTMLInputElement;

let graph: LogicGraph;
let inputValues: Record<string, boolean> = {};
let outputValues: Record<string, boolean> = {};

const container = document.getElementById('app')!;
let nodes: DataSet<Node> = new DataSet<Node>();
let edges: DataSet<Edge> = new DataSet<Edge>();
let levels: Record<string, number> = {};

function updateColors(values: Record<string, boolean>, nodeList: DataSet<Node>, edgeList: DataSet<Edge>, relevantInputs?: Set<string> ) {
  const updated = Object.entries(values).map(([id, value]) => ({
    id,
    color: {
      background: relevantInputs?.has(id)? '#7779ffff' : (value ? '#a0f0a0' : '#f0a0a0'),
    },
  }));
  nodeList.update(updated);

  const updatedEdges = edgeList.get().map(edge => {
    const id = edge.from as string
    const idt = edge.to as string
    const fromVal = values[id];
    return {
      id: edge.id,
      color: { color: relevantInputs?.has(idt)? '#0300ccff' : (fromVal ? '#00cc00' : '#cc0000') }, // green = 1, red = 0
      arrows: 'to'
    };
  });

  edgeList.update(updatedEdges);
}

function drawGraph(graph: Record<string, LogicNode>, inputValues: Record<string, boolean>) {
  levels = computeNodeLevelsFast(graph);

  const nodesArray: Node[] = Object.values(graph).map(n => ({
    id: n.id,
    label: (n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id),
    shape: 'box',
    color: { background: '#f0a0a0' },
    level: levels[n.id]
  }));

  const edgesArray: Edge[] = Object.values(graph).flatMap(n =>
    n.inputs.map(input => ({
      id: `${input}->${n.id}`,
      from: input,
      to: n.id,
      smooth: false
    }))
  );

  nodes = new DataSet<Node>(nodesArray);
  edges = new DataSet<Edge>(edgesArray);

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
        updateValues(result);
      }
      if (graph[id]?.type === "OUTPUT") {
        const deps = findDependenciesForOutput(graph, id);
        relevantInputsPerOutput[id] = deps
        updateColors(result, nodes, edges, relevantInputsPerOutput[id]);
      }
    }
  });

  const result = simulateGraph(graph, inputValues);
  updateColors(result, nodes, edges);
  updateValues(result);
}

function updateValues(result: Record<string, boolean>){
  outputValues = getOutputs(graph, result);
  inputValues = getInputs(graph, result);
  updateBitInputDisplay(inputValues);
  updateBitOutputDisplay(outputValues);
}

inputValues = generateInputs(graph4bitAdder)
graph = graph4bitAdder

drawGraph(graph, inputValues);

fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const text = await file.text();
  graph = parseCircuitFile(text);

  const components = groupByModules(graph, levels);
  console.log("Modules found:", components.length);

  inputValues = generateInputs(graph)

  updateBitInputDisplay(inputValues);
  drawGraph(graph, inputValues);
});

// Wire IDs are named "IN_<wire>" / "OUT_<wire>"; ascending wire number is the
// circuit's own MSB-first bit order (see parser.ts / settupInputs), so sort on
// it to keep the displayed bit string consistent with what "Set Inputs" accepts.
function sortByWireNumber(entries: [string, boolean][]): [string, boolean][] {
  return entries.sort(([a], [b]) => {
    const na = parseInt(a.split('_').pop()!, 10);
    const nb = parseInt(b.split('_').pop()!, 10);
    return na - nb;
  });
}

function updateBitInputDisplay(inputs: Record<string, boolean>) {
  const bitStr = sortByWireNumber(Object.entries(inputs)).map(([, value]) => value ? '1' : '0').join('');
  (document.getElementById('bitInput') as HTMLInputElement).value = bitStr;
}

function updateBitOutputDisplay(outputs: Record<string, boolean>) {
  const bitStr = sortByWireNumber(Object.entries(outputs)).map(([, value]) => value ? '1' : '0').join('');
  (document.getElementById('bitOutput') as HTMLInputElement).value = bitStr;
}

// Set Inputs from bit string
document.getElementById('applyInputs')!.addEventListener('click', () => {
  const val = (document.getElementById('bitInput') as HTMLInputElement).value.trim();
  inputValues = settupInputs(inputValues, val)
  drawGraph(graph, inputValues)
});

document.getElementById('downloadBtn')!.addEventListener('click', () => {
  if (!graph) return;
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

document.getElementById('solveBtn')!.addEventListener('click', () => {
  if(!graph) return;

  const circuit = convertGraphToCircuit(graph)
  circuit.fixed_inputs = inputValues;
  sendToSolver(circuit).then(data => {
    console.log(data)
  }).catch(showSolverUnavailableNotice)

})

document.getElementById('solveOutputsBtn')!.addEventListener('click', () => {
  if(!graph) return;

  const circuit = convertGraphToCircuit(graph)
  circuit.fixed_outputs = outputValues;
  circuit.find_all_solutions = true; // this button's dropdown is specifically for browsing multiple solutions
  sendToSolver(circuit).then(data => {
    console.log(data);
    if (data.status === "unsat" || !data.solution) {
      alert("No solution exists for these fixed outputs.");
      return;
    }
    populateDropdown(data.solution)
  }).catch(showSolverUnavailableNotice)

})

// The Solve buttons call PyZ3Server (a local Python/Z3 process) — on a static
// deploy (e.g. GitHub Pages) there's nothing listening, so the fetch rejects.
// Surface that plainly instead of letting it fail silently in the console.
function showSolverUnavailableNotice(err: unknown) {
  console.error(err);
  alert(
    "Solving requires the PyZ3Server backend (FastAPI + Z3), which isn't running here — " +
    "this is a static demo of the visualizer/simulator only.\n\n" +
    "Clone the repo and run PyZ3Server locally (see the README) to try the real solver."
  );
}

function populateDropdown(solutions: Record<string, boolean>[]) {
  const selector = document.getElementById("solutionSelector") as HTMLSelectElement;
  selector.innerHTML = "";

  solutions.forEach((solution, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = `Option ${index + 1} \t${Object.keys(solution).filter(k => graph[k].type == "INPUT").map(k => solution[k]? "1" : "0").join("")}`;
    selector.appendChild(option);
  });

  selector.addEventListener("change", () => {
    const selectedIndex = parseInt(selector.value);
    displaySolution(solutions[selectedIndex]);
  });

  // Immediately show the first option
  if (solutions.length > 0) {
    displaySolution(solutions[0]);
  }
}

function displaySolution(solution: Record<string, boolean>) {
  updateColors(solution, nodes, edges);
  updateValues(solution);
}
