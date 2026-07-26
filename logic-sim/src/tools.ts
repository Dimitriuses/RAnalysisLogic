import type { LogicGraph, LogicNode, ModuleData, OverviewGraph, OverviewNode } from "./classes";

// Only id/inputs/type are needed to compute levels, so this accepts either a
// LogicGraph or an OverviewGraph (whose 'MODULE' type isn't part of LogicGateType).
interface LevelableNode {
  id: string;
  inputs: string[];
  type: string;
}

export function computeNodeLevelsFast(graph: Record<string, LevelableNode>): Record<string, number> {
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

  // Who consumes each node's output — built once so countUniqueIO's "outputs"
  // side doesn't have to rescan the whole graph on every call. That rescan
  // (once per node processed, i.e. roughly O(n) calls each doing an O(n) scan)
  // is what made this never finish within 60s on sha256.txt's 117k nodes.
  const consumers: Record<string, string[]> = {};
  for (const node of Object.values(graph)) {
    for (const input of node.inputs) {
      (consumers[input] ??= []).push(node.id);
    }
  }

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

  function countUniqueIO(nodes: LogicNode[]): {inputs: Set<string>, outputs: Set<string>} {
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
      nodes
        .flatMap(n => consumers[n.id] ?? [])  // who consumes each module node
        .filter(consumerId => !nodeIds.has(consumerId)) // external consumers only
    );

    return { inputs, outputs };
  }

  // Bucket nodes by level once — filtering Object.values(graph) by level on
  // every iteration of the outer loop below was itself an O(n) scan done once
  // per distinct level (sha256.txt: ~5400 levels), i.e. O(n * levels) overall
  // on top of the per-node countUniqueIO cost fixed above.
  const nodesByLevel: Record<number, LogicNode[]> = {};
  for (const node of Object.values(graph)) {
    if (node.type === "INPUT" || node.type === "OUTPUT") continue;
    (nodesByLevel[levels[node.id]] ??= []).push(node);
  }
  const levelKeys = Object.keys(nodesByLevel).map(Number).sort((a, b) => a - b);

  for (const level of levelKeys) {
    const nodes = nodesByLevel[level];
    for (const node of nodes) {
      const io = countUniqueIO(currentGroup)
      if (io.inputs.size <= maxModuleSize && io.outputs.size <= maxModuleSize) {
        currentGroup.push(node);
      } else {
        pushGroup(io.inputs, io.outputs);
        currentGroup.push(node);
      }
    }
  }

  const io = countUniqueIO(currentGroup)
  pushGroup(io.inputs, io.outputs); // final group
  return modules;
}

// Collapses a large circuit into one node per module (via groupByModules),
// keeping original INPUT/OUTPUT nodes individually visible so the existing
// click-to-toggle / dependency-highlight interactions still work on them.
export function buildModuleOverview(graph: LogicGraph, levels: Record<string, number>): OverviewGraph {
  const modules = groupByModules(graph, levels);
  const moduleId = (i: number) => `module_${i}`;

  // Which module "exports" a given wire (a node id inside that module that's
  // referenced from outside it) — used to resolve module-to-module edges.
  const producerModule: Record<string, string> = {};
  modules.forEach((m, i) => {
    for (const outId of m.outputs) producerModule[outId] = moduleId(i);
  });

  const overview: OverviewGraph = {};

  for (const node of Object.values(graph)) {
    if (node.type === 'INPUT') {
      overview[node.id] = { id: node.id, type: 'INPUT', inputs: [] };
    }
  }

  modules.forEach((m, i) => {
    const id = moduleId(i);
    // Dedupe: multiple wires from the same producing module must collapse to
    // a single edge, or the "${input}->${id}" edge id collides. Keep track of
    // which raw wire(s) each resolved id actually stands for, so an edge can
    // later be colored by those specific wires rather than a whole module's
    // aggregate summary.
    const inputWireMap: Record<string, string[]> = {};
    for (const wire of m.inputs) {
      const resolved = producerModule[wire] ?? wire;
      (inputWireMap[resolved] ??= []).push(wire);
    }
    overview[id] = {
      id,
      type: 'MODULE',
      inputs: Object.keys(inputWireMap),
      inputWireMap,
      internalNodeIds: m.nodes.map(n => n.id),
      rawInputWires: [...m.inputs],
      exportedWireIds: [...m.outputs],
    };
  });

  for (const node of Object.values(graph)) {
    if (node.type === 'OUTPUT') {
      const wire = node.inputs[0];
      const producer = producerModule[wire] ?? wire;
      overview[node.id] = { id: node.id, type: 'OUTPUT', inputs: [producer], inputWireMap: { [producer]: [wire] } };
    }
  }

  return overview;
}

// computeNodeLevelsFast puts every in-degree-0 node (every INPUT) at level 0
// and every OUTPUT at the graph's max level — fine for a per-gate graph, but
// in an overview graph that crams all of a large circuit's INPUT/OUTPUT nodes
// onto two single, extremely wide rows regardless of which module actually
// uses each one. Re-anchor each INPUT next to the earliest module that
// consumes it, and each OUTPUT next to the module that produces it, so they
// spread out across the module chain instead.
export function assignOverviewLevels(overview: OverviewGraph): Record<string, number> {
  const levels = computeNodeLevelsFast(overview);
  const modules = Object.values(overview).filter(n => n.type === 'MODULE');

  for (const node of Object.values(overview)) {
    if (node.type === 'INPUT') {
      const consumerLevels = modules.filter(m => m.inputs.includes(node.id)).map(m => levels[m.id]);
      if (consumerLevels.length > 0) {
        levels[node.id] = Math.max(0, Math.min(...consumerLevels) - 1);
      }
    }
  }

  for (const node of Object.values(overview)) {
    if (node.type === 'OUTPUT') {
      const producerId = node.inputs[0];
      if (producerId in levels) {
        levels[node.id] = levels[producerId] + 1;
      }
    }
  }

  return levels;
}

// "See what's inside a module": rebuilds a module's own gates as a small,
// self-contained LogicGraph — its real internal nodes, plus synthetic INPUT
// nodes for its boundary input wires and synthetic OUTPUT nodes (id
// "<wire>_OUT", to avoid colliding with the internal gate that produces
// "<wire>") for its exported wires.
export function buildModulePreviewGraph(moduleNode: OverviewNode, fullGraph: LogicGraph): LogicGraph {
  const preview: LogicGraph = {};

  for (const gateId of moduleNode.internalNodeIds ?? []) {
    preview[gateId] = fullGraph[gateId];
  }

  for (const wire of moduleNode.rawInputWires ?? []) {
    if (!preview[wire]) {
      preview[wire] = { id: wire, type: 'INPUT', inputs: [] };
    }
  }

  for (const wire of moduleNode.exportedWireIds ?? []) {
    const outId = `${wire}_OUT`;
    preview[outId] = { id: outId, type: 'OUTPUT', inputs: [wire] };
  }

  return preview;
}