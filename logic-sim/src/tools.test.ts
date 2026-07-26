import { describe, it, expect } from 'vitest';
import { groupByModules, computeNodeLevelsFast } from './tools';
import type { LogicGraph } from './classes';

describe('groupByModules', () => {
  it("outputs are the module's own node ids with an external consumer, not the external consumer ids themselves", () => {
    const graph: LogicGraph = {
      A: { id: 'A', type: 'INPUT', inputs: [] },
      B: { id: 'B', type: 'INPUT', inputs: [] },
      G1: { id: 'G1', type: 'AND', inputs: ['A', 'B'] },
      G2: { id: 'G2', type: 'NOT', inputs: ['G1'] },
      G3: { id: 'G3', type: 'NOT', inputs: ['G2'] },
      OUT: { id: 'OUT', type: 'OUTPUT', inputs: ['G3'] },
    };
    const levels = computeNodeLevelsFast(graph);

    // maxModuleSize=1 forces the smallest possible groups, giving a
    // deterministic two-module split we can assert on exactly.
    const modules = groupByModules(graph, levels, 1);

    expect(modules.map(m => m.nodes.map(n => n.id))).toEqual([['G1'], ['G2', 'G3']]);
    expect(modules[0].inputs.slice().sort()).toEqual(['A', 'B']);
    // G1 is module 0's own exported wire (G2, outside this module, consumes
    // it) — NOT 'G2'. A prior bug collected each node's *consumers* instead
    // of checking whether a node has an external consumer, producing the
    // consumer's id ('G2') here instead of the exported node's own id
    // ('G1') — silently corrupting every module's exported-wire interface.
    expect(modules[0].outputs).toEqual(['G1']);
    expect(modules[1].inputs).toEqual(['G1']);
    expect(modules[1].outputs).toEqual(['G3']);
  });
});
