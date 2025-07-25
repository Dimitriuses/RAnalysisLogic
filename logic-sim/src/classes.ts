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