import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCircuitFile } from './parser';
import type { LogicGraph } from '../classes';

const here = dirname(fileURLToPath(import.meta.url));

function loadGraph(filename: string): LogicGraph {
  const text = readFileSync(join(here, filename), 'utf8');
  return parseCircuitFile(text);
}

function countByType(graph: LogicGraph, type: string): number {
  return Object.values(graph).filter(n => n.type === type).length;
}

function gateCount(graph: LogicGraph): number {
  return Object.values(graph).filter(n => n.type !== 'INPUT' && n.type !== 'OUTPUT').length;
}

describe('parseCircuitFile', () => {
  // sha256.txt uses the old Bristol layout: a single combined header line
  // ("<in1> <in2> <out>") rather than Bristol Fashion's two separate lines.
  // A prior bug mistook that header line for a gate line and started parsing
  // gates one line late, silently dropping gate 0 — these counts pin that fix.
  it('parses the old-Bristol 2-line header (sha256.txt) to the declared gate count', () => {
    const graph = loadGraph('sha256.txt');
    expect(gateCount(graph)).toBe(116246);
    expect(countByType(graph, 'INPUT')).toBe(512);
    expect(countByType(graph, 'OUTPUT')).toBe(256);
  });

  it('parses the Bristol Fashion 3-line header (64-bit-adder.txt) to the declared gate count', () => {
    const graph = loadGraph('64-bit-adder.txt');
    expect(gateCount(graph)).toBe(314);
    expect(countByType(graph, 'INPUT')).toBe(128);
    expect(countByType(graph, 'OUTPUT')).toBe(64);
  });

  it.each([
    ['sha256.txt'],
    ['64-bit-adder.txt'],
  ])('every OUTPUT in %s resolves to a real producer node (no phantom inputs)', (filename) => {
    const graph = loadGraph(filename);
    const outputs = Object.values(graph).filter(n => n.type === 'OUTPUT');
    expect(outputs.length).toBeGreaterThan(0);
    for (const out of outputs) {
      expect(out.inputs).toHaveLength(1);
      expect(graph[out.inputs[0]]).toBeDefined();
    }
  });
});
