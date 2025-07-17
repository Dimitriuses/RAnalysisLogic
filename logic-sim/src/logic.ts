import type { LogicGraph, LogicNode } from './classes';

export function simulateGraph(graph: LogicGraph, inputValues: Record<string, boolean>): Record<string, boolean> {
  const values: Record<string, boolean> = {};

  // Допоміжна функція для рекурсивного обчислення
  function evaluate(id: string): boolean {
    if (id in values) return values[id];

    const node = graph[id];
    if (!node) throw new Error(`Unknown node ID: ${id}`);
    // console.log(`in ${id} have ${node.inputs[0]} and ${node.inputs[1]}`)

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


// Основна функція для отримання всіх залежностей від OUTPUT
export function findDependenciesForOutput(
  graph: Record<string, LogicNode>,
  outputId: string
): Set<string> {
  //const dependencies = new Set<string>();
  const visited = new Set<string>();
  
  // Рекурсивна функція для збору залежностей
  function collectDependencies(
    nodeId: string,
    // visited: Set<string>
  ) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
  
    const node = graph[nodeId];
    for (const inputId of node.inputs) {
      collectDependencies(inputId);
    }
    // console.log(visited)
  }
  
  collectDependencies(outputId);
  return visited;
}

export function generateInputs(graph: Record<string, LogicNode>): Record<string, boolean>{
  const inputValues: Record<string, boolean> = {};
  for (const id in graph) {
    if (graph[id].type === 'INPUT') {
      inputValues[id] = false
    }
  }
  return inputValues
}

export function settupInputs(inputs: Record<string, boolean>, setupString: string ): Record<string, boolean>{
  const inputValues: Record<string, boolean> = {};
  const keys = Object.keys(inputs).sort((a, b) => {
    const aNum = parseInt(a.split('_')[1], 10);
    const bNum = parseInt(b.split('_')[1], 10);
    return aNum - bNum;
  });
  keys.forEach((v,i) => {
    inputValues[v] = setupString[i] === "1" 
  })
  console.log(keys);
  return inputValues
}

export function getOutputs(graph: Record<string, LogicNode>, results: Record<string, boolean> ): Record<string, boolean>{
  const output: Record<string, boolean> = {}
  for (const id in graph) {
    if (graph[id].type === 'OUTPUT') {
      output[id] = results[id];
    }
  }
  return output
}