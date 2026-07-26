import type { LogicGraph, LogicNode } from './classes';

export function simulateGraph(graph: LogicGraph, inputValues: Record<string, boolean>): Record<string, boolean> {
  const values: Record<string, boolean> = {};

  // Evaluates `rootId` and everything it (transitively) depends on, using an
  // explicit heap-allocated stack instead of native recursion — sha256.txt's
  // ~5400-level depth blew the JS call stack ("Maximum call stack size
  // exceeded") with a recursive evaluate(), well before hitting any V8-tunable
  // limit worth relying on. Each frame tracks how many of its own inputs have
  // already been pushed, so every input is still guaranteed to be evaluated
  // (and memoized into `values`) before its dependent's result is computed —
  // same guarantee the earlier every()/some()-short-circuit fix relied on.
  function evaluate(rootId: string) {
    const stack: { id: string; nextInput: number }[] = [{ id: rootId, nextInput: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.id in values) {
        stack.pop();
        continue;
      }

      const node = graph[frame.id];
      if (!node) throw new Error(`Unknown node ID: ${frame.id}`);

      if (node.type === 'INPUT') {
        if (!(frame.id in inputValues)) throw new Error(`Missing input value for ${frame.id}`);
        values[frame.id] = inputValues[frame.id];
        stack.pop();
        continue;
      }

      if (frame.nextInput < node.inputs.length) {
        const inputId = node.inputs[frame.nextInput++];
        if (!(inputId in values)) stack.push({ id: inputId, nextInput: 0 });
        continue;
      }

      // Every input has been pushed (and is therefore memoized by now) —
      // compute this node's own result.
      const inputs = node.inputs;
      let result: boolean;

      switch (node.type) {
        case 'AND':
          result = inputs.every(inputId => values[inputId]);
          break;

        case 'OR':
          result = inputs.some(inputId => values[inputId]);
          break;

        case 'NOT':
          if (inputs.length !== 1) throw new Error(`NOT gate ${frame.id} must have exactly one input`);
          result = !values[inputs[0]];
          break;

        case 'XOR':
          result = inputs.reduce((acc, inputId) => acc !== values[inputId], false);
          break;

        case 'NAND':
          result = !inputs.every(inputId => values[inputId]);
          break;

        case 'NOR':
          result = !inputs.some(inputId => values[inputId]);
          break;

        case 'OUTPUT':
          if (inputs.length !== 1) throw new Error(`OUTPUT node ${frame.id} must have one input`);
          result = values[inputs[0]];
          break;

        default:
          throw new Error(`Unsupported gate type: ${node.type}`);
      }

      values[frame.id] = result;
      stack.pop();
    }
  }

  // Evaluate every OUTPUT node
  for (const id in graph) {
    if (graph[id].type === 'OUTPUT') {
      evaluate(id);
    }
  }

  return values;
}


// Collect every (transitive) dependency of an OUTPUT, iteratively — an
// explicit stack instead of recursion, for the same reason as simulateGraph's
// evaluate(): sha256.txt's ~5400-level depth overflows the JS call stack.
export function findDependenciesForOutput(
  graph: Record<string, LogicNode>,
  outputId: string
): Set<string> {
  const visited = new Set<string>();
  const stack: string[] = [outputId];

  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    for (const inputId of graph[nodeId].inputs) {
      if (!visited.has(inputId)) stack.push(inputId);
    }
  }

  return visited;
}

export function splitIntoModules(graph: LogicGraph, maxInputs = 8, maxOutputs = 8): LogicGraph[] {
  const visited = new Set<string>();
  const modules: LogicGraph[] = [];

  for (const nodeId in graph) {
    if (visited.has(nodeId)) continue;

    const module: LogicGraph = {};
    const queue = [nodeId];
    const inputs = new Set<string>();
    const outputs = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      const node = graph[currentId];
      module[currentId] = node;
      visited.add(currentId);

      // Record inputs
      for (const inputId of node.inputs) {
        if (!visited.has(inputId)) {
          inputs.add(inputId);
        }
      }

      // Add downstream nodes while the module stays within its limits
      const children = Object.values(graph).filter(n => n.inputs.includes(currentId));
      for (const child of children) {
        if (
          inputs.size <= maxInputs &&
          outputs.size <= maxOutputs &&
          !visited.has(child.id)
        ) {
          queue.push(child.id);
          outputs.add(child.id);
        }
      }
    }

    modules.push(module);
  }

  return modules;
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

// Parses a typed bit string into a wire-sorted Record<string, boolean>, using
// `values`'s own keys to know which wires to set — works for either INPUT or
// OUTPUT records, since both are named "IN_<wire>" / "OUT_<wire>". The
// hardcoded default graph (graph4bitAdder in graphs.ts) uses plain ids like
// "OUT1"/"COUT" with no "_<number>" to extract, so aNum/bNum are NaN for it —
// explicitly keep those pairs in their original (already-correct) order
// instead of returning `aNum - bNum` (itself NaN), which is an unspecified
// comparator result under Array.sort and only "worked" by accident.
export function applyBitString(values: Record<string, boolean>, setupString: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const keys = Object.keys(values).sort((a, b) => {
    const aNum = parseInt(a.split('_')[1], 10);
    const bNum = parseInt(b.split('_')[1], 10);
    if (isNaN(aNum) || isNaN(bNum)) return 0;
    return aNum - bNum;
  });
  keys.forEach((v, i) => {
    result[v] = setupString[i] === "1"
  })
  return result
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

export function getInputs(graph: Record<string, LogicNode>, results: Record<string, boolean> ): Record<string, boolean>{
  const output: Record<string, boolean> = {}
  for (const id in graph) {
    if (graph[id].type === 'INPUT') {
      output[id] = results[id];
    }
  }
  return output
}