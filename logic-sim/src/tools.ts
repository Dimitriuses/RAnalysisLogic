import type { LogicGraph, LogicNode, ModuleData } from "./classes";

export function computeNodeLevelsFast(graph: Record<string, LogicNode>): Record<string, number> {
  const levels: Record<string, number> = {};
  const inDegree: Record<string, number> = {};
  const dependents: Record<string, string[]> = {};

  // Step 1: prepare in-degree and dependencies
  for (const node of Object.values(graph)) {
    inDegree[node.id] = node.inputs.length;
    for (const input of node.inputs) {
      if (!dependents[input]) dependents[input] = [];
      dependents[input].push(node.id);
    }
  }

  // Step 2: starting nodes (INPUT)
  const queue: string[] = [];
  for (const nodeId in graph) {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
      levels[nodeId] = 0;
    }
  }

  // Step 3: topological pass
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentLevel = levels[currentId];

    for (const dependentId of dependents[currentId] || []) {
      // Compute the level
      levels[dependentId] = Math.max(levels[dependentId] ?? 0, currentLevel + 1);
      inDegree[dependentId]--;

      if (inDegree[dependentId] === 0) {
        queue.push(dependentId);
      }
    }
  }

  // Step 4: force OUTPUT nodes onto the last level
  const maxLevel = Math.max(...Object.values(levels));
  for (const node of Object.values(graph)) {
    if (node.type === "OUTPUT") {
      levels[node.id] = maxLevel;
    }
  }

  return levels;
}

export function groupByModules(graph: LogicGraph, levels: Record<string, number>, maxModuleSize = 8): ModuleData[] {
  const modules: ModuleData[] = [];
  let currentGroup: LogicNode[] = [];

  function pushGroup(inputs: Set<string>, outputs: Set<string>) {
    if (currentGroup.length > 0) {
      const mdata: ModuleData = {
        id: modules.length.toString(),
        nodes: currentGroup,
        inputs: [... inputs],
        outputs: [... outputs]
      }
      modules.push(mdata);
      currentGroup = [];
    }
  };

  function countUniqueIO(nodes: LogicNode[], graph: LogicGraph): {inputs: Set<string>, outputs: Set<string>} {
    const nodeIds = new Set(nodes.map(n => n.id));

    // 1) Inputs: all predecessors of the module's nodes that are NOT in the module itself
    const inputs = new Set<string>(
      nodes
        .flatMap(n => n.inputs)              // all inputs of each node
        .filter(i => !nodeIds.has(i))        // keep only those not in the module
    );

    // 2) Outputs: all external nodes that take at least one module node as input,
    //    but we want the names of the module nodes feeding them (the module's output interface)
    const outputs = new Set<string>(
      Object.values(graph)
        .filter(v => !nodeIds.has(v.id))       // external nodes only
        .flatMap(v => v.inputs                 // look at their inputs
          .filter(i => nodeIds.has(i))         // pick the inputs that come from the module
        )
    );
    
    return { inputs, outputs };
  }

  const levelKeys = [... new Set(Object.values(levels).map(Number).sort((a, b) => a - b))];

  for (const level of levelKeys) {
    const nodes = Object.values(graph).filter(v => levels[v.id] == level && v.type != "INPUT" && v.type != "OUTPUT");
    for (const node of nodes) {
      const io = countUniqueIO(currentGroup, graph)
      if (io.inputs.size <= maxModuleSize && io.outputs.size <= maxModuleSize) {
        currentGroup.push(node);
      } else {
        pushGroup(io.inputs, io.outputs);
        currentGroup.push(node);
      }
    }
  }

  const io = countUniqueIO(currentGroup, graph)
  pushGroup(io.inputs, io.outputs); // final group
  return modules;
}