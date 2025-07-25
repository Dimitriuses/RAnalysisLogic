import type { LogicGraph, LogicNode, ModuleData } from "./classes";

export function computeNodeLevels(graph: Record<string, LogicNode>): Record<string, number> {
  const levels: Record<string, number> = {};
  const visited = new Set<string>();

  function dfs(nodeId: string, depth: number): void {
    if (levels[nodeId] === undefined || depth > levels[nodeId]) {
      levels[nodeId] = depth;
    }

    visited.add(nodeId);
    console.log(nodeId, depth, visited.size);

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

  const maxLevel = Math.max(...Object.values(levels))

  for (const node of Object.values(graph)) {
    if (node.type === "OUTPUT") {
      levels[node.id] = maxLevel;
    }
  }

  return levels;
}

export function computeNodeLevelsTopological(graph: Record<string, LogicNode>): Record<string, number> {
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

export function computeNodeLevelsFast(graph: Record<string, LogicNode>): Record<string, number> {
  const levels: Record<string, number> = {};
  const inDegree: Record<string, number> = {};
  const dependents: Record<string, string[]> = {};

  // Крок 1: підготовка in-degree та залежностей
  for (const node of Object.values(graph)) {
    inDegree[node.id] = node.inputs.length;
    for (const input of node.inputs) {
      if (!dependents[input]) dependents[input] = [];
      dependents[input].push(node.id);
    }
  }

  // Крок 2: стартові вузли (INPUT)
  const queue: string[] = [];
  for (const nodeId in graph) {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
      levels[nodeId] = 0;
    }
  }

  // Крок 3: топологічний прохід
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentLevel = levels[currentId];

    for (const dependentId of dependents[currentId] || []) {
      // Обчислення рівня
      levels[dependentId] = Math.max(levels[dependentId] ?? 0, currentLevel + 1);
      inDegree[dependentId]--;

      if (inDegree[dependentId] === 0) {
        queue.push(dependentId);
      }
    }
  }

  // Крок 4: Примусово зробити OUTPUT останнім рівнем
  const maxLevel = Math.max(...Object.values(levels));
  for (const node of Object.values(graph)) {
    if (node.type === "OUTPUT") {
      levels[node.id] = maxLevel;
    }
  }

  return levels;
}

export function tarjan(graph: LogicGraph): LogicNode[][] { // якщо має цикли
  const indexMap = new Map<string, number>();
  const lowlinkMap = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const result: LogicNode[][] = [];

  let index = 0;

  function strongConnect(nodeId: string) {
    indexMap.set(nodeId, index);
    lowlinkMap.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    const node = graph[nodeId];
    for (const inputId of node.inputs) {
      if (!indexMap.has(inputId)) {
        strongConnect(inputId);
        lowlinkMap.set(
          nodeId,
          Math.min(lowlinkMap.get(nodeId)!, lowlinkMap.get(inputId)!)
        );
      } else if (onStack.has(inputId)) {
        lowlinkMap.set(
          nodeId,
          Math.min(lowlinkMap.get(nodeId)!, indexMap.get(inputId)!)
        );
      }
    }

    if (lowlinkMap.get(nodeId) === indexMap.get(nodeId)) {
      const component: LogicNode[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(graph[w]);
      } while (w !== nodeId);
      result.push(component);
    }
  }

  for (const nodeId in graph) {
    if (!indexMap.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return result;
}

export function groupNodesByLevel(graph: LogicGraph, levels: Record<string, number>, maxNodesPerGroup = 8): LogicNode[][] {
  const levelMap: Record<number, LogicNode[]> = {};

  for (const nodeId in graph) {
    const level = levels[nodeId];
    if (!levelMap[level]) levelMap[level] = [];
    levelMap[level].push(graph[nodeId]);
  }

  const groups: LogicNode[][] = [];
  for (const level of Object.keys(levelMap).map(Number).sort((a, b) => a - b)) {
    const nodes = levelMap[level];
    for (let i = 0; i < nodes.length; i += maxNodesPerGroup) {
      groups.push(nodes.slice(i, i + maxNodesPerGroup));
    }
  }

  return groups;
}

export function groupByModules(graph: LogicGraph, levels: Record<string, number>, maxModuleSize = 8): ModuleData[] {
  const modules: ModuleData[] = [];
  let currentGroup: LogicNode[] = [];

  function pushGroup(inputs: Set<string>, outputs: Set<string>) {
    if (currentGroup.length > 0) {
      // console.log(currentGroup, inputs, outputs)
      // inputs.forEach(input => {
      //   currentGroup.push({
      //     id: input,
      //     type: "INPUT",
      //     inputs: [],
      //   })
      // })
      // outputs.forEach(output => {
      //   currentGroup.push({
      //     id: output + "#out",
      //     type: "OUTPUT",
      //     inputs: [output],
      //   })
      // })
      const mdata: ModuleData = {
        id: modules.length.toString(),
        nodes: currentGroup,
        inputs: [... inputs],
        outputs: [... outputs]
      }
      // console.log(currentGroup)
      modules.push(mdata);
      currentGroup = [];
    }
  };

  function countUniqueIO(nodes: LogicNode[], graph: LogicGraph): {inputs: Set<string>, outputs: Set<string>} {
    // const inputs = new Set<string>(
    //   nodes.map(n=> n.inputs).flat().filter(i => !nodes.some(n=> n.id == i))
    // );
    // const outputs = new Set<string>(
    //   Object.values(graph)
    //   .filter(v => !nodes.includes(v) && v.inputs.some(vin => nodes.some(n => n.id == vin)))
    //   .map(v=> v.inputs.filter(vin => nodes.some(n => n.id == vin)))
    //   .flat()
    // );

    const nodeIds = new Set(nodes.map(n => n.id));

    // 1) Вхідні вузли: всі предки модульних вузлів, що НЕ в самому модулі
    const inputs = new Set<string>(
      nodes
        .flatMap(n => n.inputs)              // усі входи кожного вузла
        .filter(i => !nodeIds.has(i))        // залишаємо лише ті, яких немає в модулі
    );

    // 2) Вихідні вузли: всі зовнішні вузли, що приймають на вхід хоча б один модульний вузол
    //    але ми хочемо саме імена модульних вузлів, які йдуть в зовнішні (щоб знати їх як outputs інтерфейс)
    const outputs = new Set<string>(
      Object.values(graph)
        .filter(v => !nodeIds.has(v.id))       // тільки зовнішні вузли
        .flatMap(v => v.inputs                 // подивитися їхні входи
          .filter(i => nodeIds.has(i))         // вибрати ті входи, що з модуля
        )
    );
    
    return { inputs, outputs };
  }


  const levelKeys = [... new Set(Object.values(levels).map(Number).sort((a, b) => a - b))];
  // console.log(levelKeys)

  for (const level of levelKeys) {
    const nodes = Object.values(graph).filter(v => levels[v.id] == level && v.type != "INPUT" && v.type != "OUTPUT");
    for (const node of nodes) {
      // currentGroup.push(node);
      // if (currentGroup.length >= maxModuleSize) {
      //   pushGroup();
      // }
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
  pushGroup(io.inputs, io.outputs); // остання група
  return modules;
}