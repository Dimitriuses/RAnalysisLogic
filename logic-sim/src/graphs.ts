import type { LogicGraph } from "./classes";

export const graph4bitAdder: LogicGraph = {
  A1: { id: "A1", level: 0, type: "INPUT", inputs: []},
  A2: { id: "A2", level: 0, type: "INPUT", inputs: []},
  A3: { id: "A3", level: 0, type: "INPUT", inputs: []},
  A4: { id: "A4", level: 0, type: "INPUT", inputs: []},

  B1: { id: "B1", level: 0, type: "INPUT", inputs: []},
  B2: { id: "B2", level: 0, type: "INPUT", inputs: []},
  B3: { id: "B3", level: 0, type: "INPUT", inputs: []},
  B4: { id: "B4", level: 0, type: "INPUT", inputs: []},

  CIN: { id: "CIN", level: 0, type: "INPUT", inputs: []},

  S1X1: { id: "S1X1", type: "XOR", inputs: ["A1", "B1"]},
  S1X2: { id: "S1X2", type: "XOR", inputs: ["S1X1", "CIN"]},
  S1A1: { id: 'S1A1', type: 'AND', inputs: ["A1", "B1"]},
  S1A2: { id: 'S1A2', type: 'AND', inputs: ["S1X1", "CIN"]},
  S1R1: { id: 'S1R1', type: 'OR', inputs: ["S1A1", "S1A2"]},

  S2X1: { id: "S2X1", type: "XOR", inputs: ["A2", "B2"]},
  S2X2: { id: "S2X2", type: "XOR", inputs: ["S2X1", "S1R1"]},
  S2A1: { id: 'S2A1', type: 'AND', inputs: ["A2", "B2"]},
  S2A2: { id: 'S2A2', type: 'AND', inputs: ["S2X1", "S1R1"]},
  S2R1: { id: 'S2R1', type: 'OR', inputs: ["S2A1", "S2A2"]},

  S3X1: { id: "S3X1", type: "XOR", inputs: ["A3", "B3"]},
  S3X2: { id: "S3X2", type: "XOR", inputs: ["S3X1", "S2R1"]},
  S3A1: { id: 'S3A1', type: 'AND', inputs: ["A2", "B2"]},
  S3A2: { id: 'S3A2', type: 'AND', inputs: ["S3X1", "S2R1"]},
  S3R1: { id: 'S3R1', type: 'OR', inputs: ["S3A1", "S3A2"]},

  S4X1: { id: "S4X1", type: "XOR", inputs: ["A4", "B4"]},
  S4X2: { id: "S4X2", type: "XOR", inputs: ["S4X1", "S3R1"]},
  S4A1: { id: 'S4A1', type: 'AND', inputs: ["A4", "B4"]},
  S4A2: { id: 'S4A2', type: 'AND', inputs: ["S4X1", "S3R1"]},
  S4R1: { id: 'S4R1', type: 'OR', inputs: ["S4A1", "S4A2"]},

  OUT1: { id: 'OUT1', type: 'OUTPUT', inputs: ['S1X2'] },
  OUT2: { id: 'OUT2', type: 'OUTPUT', inputs: ['S2X2'] },
  OUT3: { id: 'OUT3', type: 'OUTPUT', inputs: ['S3X2'] },
  OUT4: { id: 'OUT4', type: 'OUTPUT', inputs: ['S4X2'] },
  COUT: { id: 'COUT', type: 'OUTPUT', inputs: ['S4R1'] },

};

export const inputValues4bitAdder: Record<string, boolean> = { A1: false, A2: false, A3: false, A4: false, B1: false, B2: false, B3: false, B4: false, CIN: false };