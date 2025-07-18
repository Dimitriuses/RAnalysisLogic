import type { LogicGateType, LogicGraph } from "../classes";

export interface LogicGate {
  id: string;
  type: LogicGateType;
  inputs: string[];
}

export interface LogicCircuit {
  inputs: string[];
  outputs: string[];
  gates: LogicGate[];
  fixed_inputs?: Record<string, boolean>;
  fixed_outputs?: Record<string, boolean>;
}

export interface SATResponce {
  status: "sat" | "unsat";
  solution: Record<string, boolean>[];
}

export function convertGraphToCircuit(graph: LogicGraph): LogicCircuit {
  const inputs: string[] = Object.values(graph)
      .filter(node => node.type === 'INPUT')
      .map(node => node.id);
  const outputs: string[] = Object.values(graph)
      .filter(node => node.type === 'OUTPUT')
      .map(node => node.id);
  const gates: LogicGate[] = Object.values(graph).map(node => ({
      id: node.id,
      type: node.type,
      inputs: node.inputs,
    }));

  return {
    inputs,
    outputs,
    gates,
    // fixed_inputs/fixed_outputs додаються опціонально окремо
  };
}

export async function sendToSolver(circuit: LogicCircuit): Promise<SATResponce> {
  const response = await fetch("http://localhost:8000/solve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(circuit)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json() as SATResponce;
}