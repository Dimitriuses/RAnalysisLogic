import { describe, it, expect } from 'vitest';
import { simulateGraph, applyBitString } from './logic';
import type { LogicGraph } from './classes';

describe('simulateGraph', () => {
  it('evaluates every node, even AND/OR inputs that a naive every()/some() would short-circuit past', () => {
    const graph: LogicGraph = {
      A1: { id: 'A1', type: 'INPUT', inputs: [] },
      B1: { id: 'B1', type: 'INPUT', inputs: [] },
      AND1: { id: 'AND1', type: 'AND', inputs: ['A1', 'B1'] }, // A1=false would short-circuit past B1
      A2: { id: 'A2', type: 'INPUT', inputs: [] },
      B2: { id: 'B2', type: 'INPUT', inputs: [] },
      OR1: { id: 'OR1', type: 'OR', inputs: ['A2', 'B2'] }, // A2=true would short-circuit past B2
      OUT_AND: { id: 'OUT_AND', type: 'OUTPUT', inputs: ['AND1'] },
      OUT_OR: { id: 'OUT_OR', type: 'OUTPUT', inputs: ['OR1'] },
    };

    const result = simulateGraph(graph, { A1: false, B1: true, A2: true, B2: false });

    // The short-circuited inputs (B1, B2) must still show up with a real value.
    expect(Object.keys(result).sort()).toEqual(Object.keys(graph).sort());
    expect(result).toEqual({
      A1: false,
      B1: true,
      AND1: false,
      A2: true,
      B2: false,
      OR1: true,
      OUT_AND: false,
      OUT_OR: true,
    });
  });
});

describe('applyBitString', () => {
  it('preserves original key order when ids have no parseable wire number (e.g. graph4bitAdder)', () => {
    // graph4bitAdder (graphs.ts) uses plain ids like "OUT1"/"COUT" with no
    // "_<number>" suffix to sort by, unlike parsed-circuit ids ("IN_<wire>").
    // Deliberately out of numeric/alphabetical order here, so this wouldn't
    // pass by some other ordering coincidence — it should come back in
    // exactly this order, not scrambled.
    const values: Record<string, boolean> = {
      COUT: false,
      OUT3: false,
      OUT1: false,
      OUT4: false,
      OUT2: false,
    };

    const result = applyBitString(values, '10110');

    expect(Object.keys(result)).toEqual(['COUT', 'OUT3', 'OUT1', 'OUT4', 'OUT2']);
    expect(result).toEqual({
      COUT: true,
      OUT3: false,
      OUT1: true,
      OUT4: true,
      OUT2: false,
    });
  });
});
