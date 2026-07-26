from itertools import product

# & "C:\Program Files\Python310\python.exe" -m uvicorn PyZ3Server.server:app --reload
# sys.path.append(os.path.dirname(__file__))  # add the current folder to the path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from PyZ3Server.classes import LogicCircuit, ModuleData
from PyZ3Server.parser import convert_to_z3
from PyZ3Server.solver import solve_all

app = FastAPI()

origins = [
    "http://localhost:5173",  # or whatever port Vite runs on
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # can be ["*"] to allow all origins (not recommended in production)
    allow_credentials=True,
    allow_methods=["*"],  # allow all methods: GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # allow any headers
)

# print(dir(z3))

@app.post("/simulate")
def simulate_logic(circuit: LogicCircuit):
    # print(circuit)
    try:
        # TODO: parse into Z3 / SMT here
        return {
            "message": "Accepted",
            "gates_count": len(circuit.gates),
            "data": convert_to_z3(circuit)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@app.post("/solve")
def solve_logic_circuit(circuit: LogicCircuit):
    variables, constraints = convert_to_z3(circuit)
    # print("w to r")
    # result = solve_circuit(variables, constraints)
    result = solve_all(variables, constraints)
    if result is None:
        return {"status": "unsat", "solution": None}
    else:
        return {"status": "sat", "solution": result}
    

@app.post("/truth-table")
def generate_truth_table(module: ModuleData):
    table = []

    input_combinations = list(product([False, True], repeat=len(module.inputs)))

    for combo in input_combinations:
        # Assign values to the inputs
        node_values = {node.id: None for node in module.nodes}
        for i, input_id in enumerate(module.inputs):
            node_values[input_id] = combo[i]

        # Simulate value propagation
        unresolved = module.nodes.copy()
        while unresolved:
            next_round = []
            for node in unresolved:
                input_vals = [node_values.get(inp) for inp in node.inputs]
                if None in input_vals:
                    next_round.append(node)
                    continue

                if node.type == "AND":
                    node_values[node.id] = all(input_vals)
                elif node.type == "OR":
                    node_values[node.id] = any(input_vals)
                elif node.type == "NOT":
                    node_values[node.id] = not input_vals[0]
                elif node.type == "XOR":
                    node_values[node.id] = sum(input_vals) % 2 == 1
                elif node.type == "NAND":
                    node_values[node.id] = not all(input_vals)
                elif node.type == "NOR":
                    node_values[node.id] = not any(input_vals)
                else:
                    node_values[node.id] = False  # fallback
            if len(next_round) == len(unresolved):
                break  # prevent an infinite loop
            unresolved = next_round

        # Collect the outputs
        output_values = [node_values.get(out_id, None) for out_id in module.outputs]
        table.append({
            "input": combo,
            "output": output_values
        })

    return {
        "moduleId": module.id,
        "inputs": module.inputs,
        "outputs": module.outputs,
        "table": table
    }

