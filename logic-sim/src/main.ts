import './style.css'
import { Network, type Node, type Edge, type Options } from 'vis-network';
import { DataSet } from 'vis-data';
import type { LogicGraph, OverviewGraph, OverviewNode } from './classes.ts';
import { applyBitString, findDependenciesForOutput, generateInputs, getInputs, getOutputs, simulateGraph } from './logic.ts';
import { graph4bitAdder } from './graphs.ts';
import { assignOverviewLevels, buildModuleOverview, buildModulePreviewGraph, computeNodeLevelsFast } from './tools.ts';
import { parseCircuitFile } from './shared/parser.ts';
import { convertGraphToCircuit, sendToSolver, sendToTruthTable, type ModuleData, type TruthTableResponse } from './shared/shared.ts';

// Bundled so the hosted demo can actually reach the module-overview code path.
// The built-in graph4bitAdder is only ~9 levels deep — below
// MODULE_VIEW_LEVEL_THRESHOLD — so on a static deploy, where a visitor has no
// circuit file to upload, every module feature was previously unreachable.
// 6.5 KB inlined; sha256.txt (3.1 MB) is deliberately not bundled, since it
// still can't render (see KNOWNISSUES.md).
import adder64Source from './shared/64-bit-adder.txt?raw';

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const sampleSelect = document.getElementById('sampleSelect') as HTMLSelectElement;

let graph: LogicGraph;
let inputValues: Record<string, boolean> = {};
let outputValues: Record<string, boolean> = {};

const container = document.getElementById('app')!;
let nodes: DataSet<Node> = new DataSet<Node>();
let edges: DataSet<Edge> = new DataSet<Edge>();
let levels: Record<string, number> = {};
// The vis-network instance for the main view, kept so the smoke test can ask
// where a node was actually drawn (getPositions/canvasToDOM) and click it for
// real. Reassigned by every drawGraph call.
let network: Network | null = null;

// Circuits deeper than this render as a module overview instead of one node
// per gate (see buildModuleOverview) — a real per-gate render of something
// like the 64-bit adder (~190 levels) collapses into an illegible mesh of
// crossing edges once vis-network auto-zooms to fit it all in view.
const MODULE_VIEW_LEVEL_THRESHOLD = 30;

// groupByModules (which buildModuleOverview relies on) rescans the whole
// graph once per node, i.e. roughly O(n^2) — fine at hundreds of nodes (the
// 64-bit adder: 506, well under a second) but it did not finish within 60s
// against sha256.txt's 117,014 nodes in a standalone timing test. Skipping
// overview mode above this and falling back to the flat render is a
// deliberate choice: still-illegible-but-instant beats hanging the tab.
const MODULE_VIEW_MAX_NODES = 5000;

// Which ids are actually rendered right now (null in flat/per-gate mode,
// where every simulated id is rendered). Set by drawGraph; read by anything
// else that colors the graph from a simulation/solver result (displaySolution).
let renderedIds: Set<string> | null = null;

// MODULE-node metadata for the currently rendered graph (null in flat/per-gate
// mode, where there are no modules at all). Set by drawGraph; read by
// updateColors (for the whole-module green/red/mixed summary below), by the
// click handler (to expand dependency highlighting into modules), and to
// build the "what's inside" sub-graph preview.
let moduleExportedWires: Record<string, string[]> | null = null;
let moduleInternalIds: Record<string, string[]> | null = null;

function filterToRendered(values: Record<string, boolean>): Record<string, boolean> {
  if (!renderedIds) return values;
  return Object.fromEntries(Object.entries(values).filter(([id]) => renderedIds!.has(id)));
}

// true/false only when every one of the given wires agrees; null (mixed, or
// unknown because we weren't given a full simulation result) falls back to
// neutral.
function summarizeWires(wires: string[] | undefined, fullResult?: Record<string, boolean>): boolean | null {
  if (!wires || !fullResult) return null;
  const vals = wires.map(w => fullResult[w]).filter((v): v is boolean => v !== undefined);
  if (vals.length === 0) return null;
  if (vals.every(v => v)) return true;
  if (vals.every(v => !v)) return false;
  return null;
}

// A module has no single boolean value of its own — summarize it from all its
// exported wires so the "lit path" doesn't just go dark at module boundaries.
// Used for the module's own box color; a specific outgoing edge uses just the
// wire(s) it actually carries instead (see OverviewEdge.sourceWireIds below),
// since a module's exported wires can legitimately disagree with each other
// while the single wire behind one particular edge is still unambiguous.
function summarizeModule(moduleId: string, fullResult?: Record<string, boolean>): boolean | null {
  return summarizeWires(moduleExportedWires?.[moduleId], fullResult);
}

// vis-network's own Edge type has no room for which raw wire(s) a resolved
// module-overview edge stands for (see buildModuleOverview's inputWireMap) —
// carried as an extra field on the same object instead of a parallel map.
type OverviewEdge = Edge & { sourceWireIds?: string[] };

function updateColors(
  values: Record<string, boolean>,
  nodeList: DataSet<Node>,
  edgeList: DataSet<Edge>,
  relevantInputs?: Set<string>,
  fullResult?: Record<string, boolean>
) {
  const updated = Object.entries(values).map(([id, value]) => ({
    id,
    color: {
      background: relevantInputs?.has(id)? '#7779ffff' : (value ? '#a0f0a0' : '#f0a0a0'),
    },
  }));
  if (moduleExportedWires) {
    for (const moduleId of Object.keys(moduleExportedWires)) {
      const summary = summarizeModule(moduleId, fullResult);
      const background = relevantInputs?.has(moduleId)
        ? '#7779ffff'
        : summary === null ? '#cfe2ff' : (summary ? '#a0f0a0' : '#f0a0a0');
      updated.push({ id: moduleId, color: { background } });
    }
  }
  nodeList.update(updated);

  const updatedEdges = edgeList.get().map(edge => {
    const id = edge.from as string
    const idt = edge.to as string
    const isRelevant = relevantInputs?.has(idt) ?? false;
    const sourceWireIds = (edge as OverviewEdge).sourceWireIds;
    const fromVal = id in values ? values[id] : (sourceWireIds ? summarizeWires(sourceWireIds, fullResult) : summarizeModule(id, fullResult));
    const color = isRelevant
      ? '#0300ccff'
      : (fromVal === null || fromVal === undefined ? '#9aa0a6' : (fromVal ? '#00cc00' : '#cc0000')); // green = 1, red = 0
    return {
      id: edge.id,
      color: { color },
      // Widen relevant edges too — on a module overview, a 1px line in the
      // same blue as everything else is easy to miss; a highlighted path
      // should read as obviously thicker, not just differently colored.
      width: isRelevant ? 3 : 1,
      arrows: 'to'
    };
  });

  edgeList.update(updatedEdges);
}

function drawGraph(graph: LogicGraph, inputValues: Record<string, boolean>) {
  levels = computeNodeLevelsFast(graph);
  const maxLevel = Math.max(...Object.values(levels));
  const useOverview = maxLevel > MODULE_VIEW_LEVEL_THRESHOLD && Object.keys(graph).length <= MODULE_VIEW_MAX_NODES;

  // Every LogicNode already structurally satisfies OverviewNode (a plain
  // LogicGateType is a valid LogicGateType | 'MODULE'), so the flat case just
  // renders `graph` itself — no separate node-building code path needed.
  const renderGraph: OverviewGraph = useOverview ? buildModuleOverview(graph, levels) : graph;
  const renderLevels = useOverview ? assignOverviewLevels(renderGraph) : levels;

  renderedIds = useOverview ? new Set(Object.keys(renderGraph)) : null;
  if (useOverview) {
    moduleExportedWires = {};
    moduleInternalIds = {};
    for (const n of Object.values(renderGraph)) {
      if (n.type === 'MODULE') {
        moduleExportedWires[n.id] = n.exportedWireIds ?? [];
        moduleInternalIds[n.id] = n.internalNodeIds ?? [];
      }
    }
  } else {
    moduleExportedWires = null;
    moduleInternalIds = null;
  }

  const nodesArray: Node[] = Object.values(renderGraph).map(n => ({
    id: n.id,
    label: n.type === 'MODULE'
      ? `Module ${n.id.split('_').pop()}\n(${n.internalNodeIds?.length ?? 0} gates)`
      : (n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id),
    shape: 'box',
    color: { background: n.type === 'MODULE' ? '#cfe2ff' : '#f0a0a0' },
    level: renderLevels[n.id]
  }));

  // One rendered edge per underlying wire, not one per module pair: several
  // raw wires often collapse onto the same resolved module-to-module
  // connection (see buildModuleOverview's inputWireMap), and summarizing all
  // of them into a single line meant that line showed gray (mixed) whenever
  // any two of those unrelated wires disagreed — common the moment more than
  // one input is active, even though each individual wire is unambiguous.
  const edgesArray: OverviewEdge[] = Object.values(renderGraph).flatMap(n =>
    n.inputs.flatMap(input => {
      const wires = n.inputWireMap?.[input] ?? [input];
      return wires.map(wire => ({
        id: `${wire}->${n.id}`,
        from: input,
        to: n.id,
        smooth: false as const,
        sourceWireIds: [wire],
      }));
    })
  );

  // Multiple edges now commonly share the same node pair — with smooth off
  // they'd draw as one indistinguishable straight line, silently hiding all
  // but whichever one happened to paint last. Curve them apart (alternating
  // sides, increasing roundness) so each wire's own color is actually visible.
  const edgesByPair = new Map<string, OverviewEdge[]>();
  for (const e of edgesArray) {
    const key = `${e.from}->${e.to}`;
    (edgesByPair.get(key) ?? edgesByPair.set(key, []).get(key)!).push(e);
  }
  for (const group of edgesByPair.values()) {
    if (group.length <= 1) continue;
    group.forEach((e, i) => {
      e.smooth = { enabled: true, type: i % 2 === 0 ? 'curvedCW' : 'curvedCCW', roundness: 0.15 * (Math.floor(i / 2) + 1) };
    });
  }

  nodes = new DataSet<Node>(nodesArray);
  edges = new DataSet<Edge>(edgesArray);

  const options: Options = {
    physics: false,
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD', 
        sortMethod: 'directed',
        levelSeparation: 40,
        nodeSpacing: 80,
      }
    },
    edges: {
      smooth: false 
    }
  };

  network = new Network(container, { nodes, edges }, options); // 'vis-network'
  let relevantInputsPerOutput: Record<string, Set<string>> = {};

  network.on('click', function (params) {
    if (params.nodes.length > 0) {
      const id = params.nodes[0];
      if (graph[id]?.type === 'INPUT') {
        inputValues[id] = !inputValues[id];
      }
      // Always recompute fresh — the OUTPUT and MODULE branches below used to
      // close over the `result` from drawGraph's initial render instead,
      // which never reflected any INPUT toggles made since. Their own value
      // coloring (green/red) silently went stale; only the OUTPUT branch's
      // dependency highlight (blue) stayed correct, since that depends on
      // graph structure, not values, masking the bug entirely if you never
      // looked closely at value colors after toggling an input first.
      const currentResult = simulateGraph(graph, inputValues);

      if (graph[id]?.type === 'INPUT') {
        updateColors(filterToRendered(currentResult), nodes, edges, undefined, currentResult);
        updateValues(currentResult);
      }
      if (graph[id]?.type === "OUTPUT") {
        const deps = findDependenciesForOutput(graph, id);
        if (moduleInternalIds) {
          for (const [moduleId, internalIds] of Object.entries(moduleInternalIds)) {
            if (internalIds.some(gid => deps.has(gid))) deps.add(moduleId);
          }
        }
        relevantInputsPerOutput[id] = deps
        updateColors(filterToRendered(currentResult), nodes, edges, relevantInputsPerOutput[id], currentResult);
      }
      const moduleNode = renderGraph[id];
      if (moduleNode?.type === 'MODULE') {
        showModulePreview(moduleNode, graph, currentResult);
      }
    }
  });

  const result = simulateGraph(graph, inputValues);
  updateColors(filterToRendered(result), nodes, edges, undefined, result);
  updateValues(result);
}

// Test hook. tools/smoke.mjs asserts on the graph the app actually rendered
// (node/edge counts, module ids, live bit values) instead of inferring it from
// canvas pixels — vis-network draws to a canvas, so there is no DOM to query.
// Getters rather than a snapshot: an INPUT toggle updates values in place
// without re-running drawGraph, so a captured object would go stale.
Object.defineProperty(window, '__logicSim', {
  value: {
    get nodes() { return nodes; },
    get edges() { return edges; },
    get graph() { return graph; },
    get inputValues() { return inputValues; },
    get outputValues() { return outputValues; },
    get renderedIds() { return renderedIds; },
    get moduleInternalIds() { return moduleInternalIds; },
    get network() { return network; },
  },
});

function updateValues(result: Record<string, boolean>){
  outputValues = getOutputs(graph, result);
  inputValues = getInputs(graph, result);
  updateBitInputDisplay(inputValues);
  updateBitOutputDisplay(outputValues);
}

// "See what's inside a module": a read-only preview of a module's own gates,
// as a small flat sub-graph, colored from the same simulation result as the
// main view rather than re-simulated — it's a snapshot at click time, not
// live-updating if the main circuit changes while the panel is open. Also
// offers a "Truth Table" tab (via the existing /truth-table endpoint), the
// original point of grouping gates into modules in the first place — see
// ROADMAP.
const modulePreviewModal = document.getElementById('modulePreviewModal')!;
const modulePreviewContainer = document.getElementById('modulePreviewContainer')!;
const modulePreviewTableContainer = document.getElementById('modulePreviewTableContainer')!;
const modulePreviewTitle = document.getElementById('modulePreviewTitle')!;
const previewTabGraph = document.getElementById('previewTabGraph')!;
const previewTabTable = document.getElementById('previewTabTable')!;

// Set by showModulePreview; read when the Truth Table tab is first opened
// (fetched lazily, cached per module-open so switching tabs back and forth
// doesn't re-fetch).
let currentPreviewModuleNode: OverviewNode | null = null;
let currentPreviewFullGraph: LogicGraph | null = null;
let currentPreviewTruthTable: TruthTableResponse | null = null;

document.getElementById('closeModulePreview')!.addEventListener('click', () => {
  modulePreviewModal.classList.add('hidden');
  modulePreviewContainer.innerHTML = '';
  modulePreviewTableContainer.innerHTML = '';
  currentPreviewModuleNode = null;
  currentPreviewFullGraph = null;
  currentPreviewTruthTable = null;
});

previewTabGraph.addEventListener('click', () => {
  previewTabGraph.classList.add('active');
  previewTabTable.classList.remove('active');
  modulePreviewContainer.classList.remove('hidden');
  modulePreviewTableContainer.classList.add('hidden');
});

previewTabTable.addEventListener('click', () => {
  previewTabTable.classList.add('active');
  previewTabGraph.classList.remove('active');
  modulePreviewContainer.classList.add('hidden');
  modulePreviewTableContainer.classList.remove('hidden');
  loadAndShowTruthTable();
});

function buildModuleDataPayload(moduleNode: OverviewNode, fullGraph: LogicGraph): ModuleData {
  return {
    id: moduleNode.id,
    nodes: (moduleNode.internalNodeIds ?? []).map(id => {
      const n = fullGraph[id];
      return { id: n.id, type: n.type, inputs: n.inputs };
    }),
    inputs: moduleNode.rawInputWires ?? [],
    outputs: moduleNode.exportedWireIds ?? [],
  };
}

function renderTruthTable(container: HTMLElement, result: TruthTableResponse) {
  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'truth-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  result.inputs.forEach(wire => {
    const th = document.createElement('th');
    th.textContent = wire;
    headerRow.appendChild(th);
  });
  result.outputs.forEach((wire, i) => {
    const th = document.createElement('th');
    th.textContent = wire;
    if (i === 0) th.classList.add('truth-table-output-start');
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of result.table) {
    const tr = document.createElement('tr');
    row.input.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v ? '1' : '0';
      tr.appendChild(td);
    });
    row.output.forEach((v, i) => {
      const td = document.createElement('td');
      td.textContent = v ? '1' : '0';
      if (i === 0) td.classList.add('truth-table-output-start');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  container.appendChild(table);
}

function loadAndShowTruthTable() {
  if (currentPreviewTruthTable) {
    renderTruthTable(modulePreviewTableContainer, currentPreviewTruthTable);
    return;
  }
  if (!currentPreviewModuleNode || !currentPreviewFullGraph) return;

  modulePreviewTableContainer.innerHTML = '<p>Loading truth table…</p>';
  const payload = buildModuleDataPayload(currentPreviewModuleNode, currentPreviewFullGraph);
  sendToTruthTable(payload).then(result => {
    currentPreviewTruthTable = result;
    renderTruthTable(modulePreviewTableContainer, result);
  }).catch(err => {
    console.error(err);
    modulePreviewTableContainer.innerHTML = '';
    const msg = document.createElement('p');
    msg.textContent = "Truth table requires the PyZ3Server backend (FastAPI + Z3), which isn't running here — this is a static demo of the visualizer/simulator only.";
    modulePreviewTableContainer.appendChild(msg);
  });
}

function buildPreviewValues(previewGraph: LogicGraph, fullResult: Record<string, boolean>): Record<string, boolean> {
  const values: Record<string, boolean> = {};
  for (const node of Object.values(previewGraph)) {
    values[node.id] = node.type === 'OUTPUT' ? fullResult[node.inputs[0]] : fullResult[node.id];
  }
  return values;
}

function renderModulePreview(container: HTMLElement, previewGraph: LogicGraph, previewValues: Record<string, boolean>) {
  const previewLevels = computeNodeLevelsFast(previewGraph);

  const nodesArray: Node[] = Object.values(previewGraph).map(n => ({
    id: n.id,
    label: n.type != "INPUT" && n.type != "OUTPUT" ? n.type : n.id.replace(/_OUT$/, ''),
    shape: 'box',
    color: { background: previewValues[n.id] ? '#a0f0a0' : '#f0a0a0' },
    level: previewLevels[n.id]
  }));

  const edgesArray: Edge[] = Object.values(previewGraph).flatMap(n =>
    n.inputs.map(input => ({
      id: `${input}->${n.id}`,
      from: input,
      to: n.id,
      smooth: false,
      color: { color: previewValues[input] ? '#00cc00' : '#cc0000' },
      arrows: 'to'
    }))
  );

  const previewNodes = new DataSet<Node>(nodesArray);
  const previewEdges = new DataSet<Edge>(edgesArray);
  new Network(container, { nodes: previewNodes, edges: previewEdges }, {
    physics: false,
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        sortMethod: 'directed',
        levelSeparation: 40,
        nodeSpacing: 80,
      }
    },
    edges: { smooth: false }
  });
}

function showModulePreview(moduleNode: OverviewNode, fullGraph: LogicGraph, fullResult: Record<string, boolean>) {
  const previewGraph = buildModulePreviewGraph(moduleNode, fullGraph);
  const previewValues = buildPreviewValues(previewGraph, fullResult);

  currentPreviewModuleNode = moduleNode;
  currentPreviewFullGraph = fullGraph;
  currentPreviewTruthTable = null;

  modulePreviewTitle.textContent = `Module ${moduleNode.id.split('_').pop()} — ${moduleNode.internalNodeIds?.length ?? 0} gates`;
  modulePreviewContainer.innerHTML = '';
  modulePreviewTableContainer.innerHTML = '';
  // Always reopen on the Graph tab, regardless of which tab was active when a
  // previous module preview was closed.
  previewTabGraph.classList.add('active');
  previewTabTable.classList.remove('active');
  modulePreviewContainer.classList.remove('hidden');
  modulePreviewTableContainer.classList.add('hidden');

  // Show the modal first — while hidden, the container measures 0x0. Even
  // after unhiding it, the 80vh flex layout doesn't necessarily finish
  // settling within the same synchronous tick (observed: clientHeight was
  // still 722px right after removing "hidden", growing to ~1016px shortly
  // after) — building the Network against that transient size leaves
  // vis-network's fit/positions computed for a canvas smaller than what it
  // then resizes to, so the content ends up outside the visible area.
  // requestAnimationFrame runs after the browser's next layout/paint, so by
  // then the size has settled.
  modulePreviewModal.classList.remove('hidden');
  requestAnimationFrame(() => {
    renderModulePreview(modulePreviewContainer, previewGraph, previewValues);
  });
}

// Swap in a new circuit: reset its inputs to all-zero, redraw, and refresh the
// bit displays. Shared by the sample selector and the file picker so both take
// exactly the same path.
function applyGraph(newGraph: LogicGraph) {
  graph = newGraph;
  inputValues = generateInputs(graph);
  updateBitInputDisplay(inputValues);
  drawGraph(graph, inputValues);
}

const SAMPLES: Record<string, () => LogicGraph> = {
  adder4: () => graph4bitAdder,
  adder64: () => parseCircuitFile(adder64Source),
};

applyGraph(SAMPLES.adder4());

sampleSelect.addEventListener('change', () => {
  const build = SAMPLES[sampleSelect.value];
  if (!build) return;
  // Parsing the 64-bit adder plus its module grouping takes a beat; clear the
  // file picker so the two circuit sources can't visually disagree about
  // what's currently loaded.
  fileInput.value = '';
  applyGraph(build());
});

fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const text = await file.text();
  applyGraph(parseCircuitFile(text));
});

// Wire IDs are named "IN_<wire>" / "OUT_<wire>"; ascending wire number is the
// circuit's own MSB-first bit order (see parser.ts / applyBitString), so sort on
// it to keep the displayed bit string consistent with what "Set Inputs"/"Set Outputs" accept.
// The hardcoded default graph (graph4bitAdder in graphs.ts) uses plain ids like
// "OUT1"/"COUT" with no "_<number>" to extract, so na/nb are NaN for it —
// explicitly keep those pairs in their original (already-correct) order
// instead of returning `na - nb` (itself NaN), which is an unspecified
// comparator result under Array.sort and only "worked" by accident.
function sortByWireNumber(entries: [string, boolean][]): [string, boolean][] {
  return entries.sort(([a], [b]) => {
    const na = parseInt(a.split('_').pop()!, 10);
    const nb = parseInt(b.split('_').pop()!, 10);
    if (isNaN(na) || isNaN(nb)) return 0;
    return na - nb;
  });
}

function updateBitInputDisplay(inputs: Record<string, boolean>) {
  const bitStr = sortByWireNumber(Object.entries(inputs)).map(([, value]) => value ? '1' : '0').join('');
  (document.getElementById('bitInput') as HTMLInputElement).value = bitStr;
}

function updateBitOutputDisplay(outputs: Record<string, boolean>) {
  const bitStr = sortByWireNumber(Object.entries(outputs)).map(([, value]) => value ? '1' : '0').join('');
  (document.getElementById('bitOutput') as HTMLInputElement).value = bitStr;
}

// Set Inputs from bit string
document.getElementById('applyInputs')!.addEventListener('click', () => {
  const val = (document.getElementById('bitInput') as HTMLInputElement).value.trim();
  inputValues = applyBitString(inputValues, val)
  drawGraph(graph, inputValues)
});

// Set a target for Output bits (used by "Solve (fix outputs)") without
// requiring the user to first manually reach that output via the inputs.
document.getElementById('applyOutputs')!.addEventListener('click', () => {
  const val = (document.getElementById('bitOutput') as HTMLInputElement).value.trim();
  outputValues = applyBitString(outputValues, val)
  updateBitOutputDisplay(outputValues);
});

document.getElementById('downloadBtn')!.addEventListener('click', () => {
  if (!graph) return;
  const data = {
    inputs: Object.values(graph).filter(v => v.type == "INPUT").map(v => v.id),
    outputs: Object.values(graph).filter(v => v.type == "OUTPUT").map(v => v.id),
    gates: Object.values(graph)
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'logic-graph2.json';
  a.click();
});

document.getElementById('solveBtn')!.addEventListener('click', () => {
  if(!graph) return;

  const circuit = convertGraphToCircuit(graph)
  circuit.fixed_inputs = inputValues;
  // Fixed inputs admit exactly one assignment, so leave find_all_solutions at
  // its default and render that answer. This used to only console.log(data),
  // i.e. the button appeared to do nothing at all when the backend was up.
  sendToSolver(circuit).then(data => {
    if (data.status === "unsat" || !data.solution?.length) {
      alert("No solution exists for these fixed inputs.");
      return;
    }
    displaySolution(data.solution[0]);
  }).catch(showSolverUnavailableNotice)

})

document.getElementById('solveOutputsBtn')!.addEventListener('click', () => {
  if(!graph) return;

  const circuit = convertGraphToCircuit(graph)
  circuit.fixed_outputs = outputValues;
  circuit.find_all_solutions = true; // this button's dropdown is specifically for browsing multiple solutions
  sendToSolver(circuit).then(data => {
    console.log(data);
    if (data.status === "unsat" || !data.solution) {
      alert("No solution exists for these fixed outputs.");
      return;
    }
    populateDropdown(data.solution)
  }).catch(showSolverUnavailableNotice)

})

// The Solve buttons call PyZ3Server (a local Python/Z3 process) — on a static
// deploy (e.g. GitHub Pages) there's nothing listening, so the fetch rejects.
// Surface that plainly instead of letting it fail silently in the console.
function showSolverUnavailableNotice(err: unknown) {
  console.error(err);
  alert(
    "Solving requires the PyZ3Server backend (FastAPI + Z3), which isn't running here — " +
    "this is a static demo of the visualizer/simulator only.\n\n" +
    "Clone the repo and run PyZ3Server locally (see the README) to try the real solver."
  );
}

function populateDropdown(solutions: Record<string, boolean>[]) {
  const selector = document.getElementById("solutionSelector") as HTMLSelectElement;
  selector.innerHTML = "";

  solutions.forEach((solution, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = `Option ${index + 1} \t${Object.keys(solution).filter(k => graph[k].type == "INPUT").map(k => solution[k]? "1" : "0").join("")}`;
    selector.appendChild(option);
  });

  selector.addEventListener("change", () => {
    const selectedIndex = parseInt(selector.value);
    displaySolution(solutions[selectedIndex]);
  });

  // Immediately show the first option
  if (solutions.length > 0) {
    displaySolution(solutions[0]);
  }
}

function displaySolution(solution: Record<string, boolean>) {
  updateColors(filterToRendered(solution), nodes, edges, undefined, solution);
  updateValues(solution);
}
