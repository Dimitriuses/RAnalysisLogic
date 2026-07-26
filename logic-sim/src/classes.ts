export type LogicGateType = 'INPUT' | 'OUTPUT' | 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR';

export interface LogicNode {
  id: string;
  level?: number
  type: LogicGateType;
  inputs: string[];
  value?: boolean;
}

export type LogicGraph = Record<string, LogicNode>;

export interface ModuleData {
  id: string;
  nodes: LogicNode[];
  inputs: string[];
  outputs: string[];
}

// A coarser view of a LogicGraph for large circuits: individual gates are
// collapsed into 'MODULE' nodes (see buildModuleOverview in tools.ts), while
// INPUT/OUTPUT nodes stay individually visible so the existing click-to-toggle
// / dependency-highlight interactions keep working.
export interface OverviewNode {
  id: string;
  type: LogicGateType | 'MODULE';
  inputs: string[]; // resolved to producer MODULE/INPUT ids, for the overview graph's own edges
  // Which original wire(s) a given resolved `inputs` entry stands for — several
  // raw wires from the same producing module collapse onto one resolved edge
  // (see buildModuleOverview's dedup), so an edge alone doesn't say which of
  // that module's exported wires it actually carries. Used to color an edge by
  // the specific wire(s) it represents instead of the whole module's summary.
  inputWireMap?: Record<string, string[]>;
  // The rest are only set when type === 'MODULE':
  internalNodeIds?: string[]; // every original gate id collapsed into this module
  rawInputWires?: string[]; // original boundary input wire ids (unresolved — for the sub-graph preview)
  exportedWireIds?: string[]; // original wire ids this module exports (for value-summary coloring and the preview's outputs)
}

export type OverviewGraph = Record<string, OverviewNode>;