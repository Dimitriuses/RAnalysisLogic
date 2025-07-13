import './style.css'
// import typescriptLogo from './typescript.svg'
// import viteLogo from '/vite.svg'
// import { setupCounter } from './counter.ts'
import { Network, type Node, type Edge } from 'vis-network';
import { DataSet } from 'vis-data';
import type { LogicNode, LogicGraph } from './classes.ts';
import { findDependenciesForOutput, simulateGraph } from './logic.ts';
import { graph4bitAdder, inputValues4bitAdder } from './graphs.ts';
import { computeNodeLevels, computeNodeLevelsTopological } from './tools.ts';

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

function main(graph: Record<string, LogicNode>, inputValues: Record<string, boolean>) {
  // const levels = computeNodeLevelsTopological(graph);
  const levels = computeNodeLevels(graph);

  const nodesArray: Node[] = Object.values(graph).map(n => ({
    id: n.id,
    label: (n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id),
    shape: 'box',
    color: { background: '#f0a0a0' },
    level: levels[n.id]
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

  const options = {
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

  const network = new Network(container, { nodes, edges }, options);
  let relevantInputsPerOutput: Record<string, Set<string>> = {};

  network.on('click', function (params) {
    if (params.nodes.length > 0) {
      const id = params.nodes[0];
      if (graph[id]?.type === 'INPUT') {
        inputValues[id] = !inputValues[id];
        const result = simulateGraph(graph, inputValues);
        updateColors(result, nodes, edges);
      }
      if (graph[id]?.type === "OUTPUT") {
        const deps = findDependenciesForOutput(graph, id);
        // relevantInputsPerOutput[id] = new Set(
        //   Array.from(deps).filter(id => graph[id].type === "INPUT")
        // );
        relevantInputsPerOutput[id] = deps
        console.log(relevantInputsPerOutput);
        updateColors(result, nodes, edges, relevantInputsPerOutput[id]);
      }
    }
  });

  const result = simulateGraph(graph, inputValues);
  updateColors(result, nodes, edges);
}

main(graph4bitAdder, inputValues4bitAdder);


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
