import type { LogicNode } from "./classes";

export function computeNodeLevels(graph: Record<string, LogicNode>): Record<string, number> {
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