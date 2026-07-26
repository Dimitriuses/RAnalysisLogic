from typing import Dict
from z3 import Xor, Bool, And, Or, Not, BoolRef

from PyZ3Server.classes import LogicCircuit

def convert_to_z3(
    circuit: LogicCircuit,
    
):
    # Create all variables
    variables: Dict[str, BoolRef] = {}

    # Inputs first
    for name in circuit.inputs:
        variables[name] = Bool(name)
        # print(name)

    # Then intermediate and output wires
    for gate in circuit.gates:
        for name in gate.inputs + [gate.id]:
            # print(name)
            if name not in variables:
                variables[name] = Bool(name)
                # print(name)
    constraints = []
    for gate in circuit.gates:
        if(gate.type == 'INPUT'): continue
        a = variables.get(gate.inputs[0]) if len(gate.inputs) > 0 else None
        b = variables.get(gate.inputs[1]) if len(gate.inputs) > 1 else None
        out = variables[gate.id]

        # print(f"Processing gate {gate.id} type {gate.type}, inputs: {gate.inputs}")
        # print(f"a = {a}, b = {b}, out = {out}")
        
        if gate.type == "XOR":
            if b is None:
                raise ValueError(f"XOR gate {gate.id} missing second input")
            constraints.append(out == Xor(a, b))
        elif gate.type == "AND":
            if b is None:
                raise ValueError(f"AND gate {gate.id} missing second input")
            constraints.append(out == And(a, b))
        elif gate.type == "OR":
            if b is None:
                raise ValueError(f"OR gate {gate.id} missing second input")
            constraints.append(out == Or(a, b))
        elif gate.type == "NOT":
            constraints.append(out == Not(a))
        elif gate.type == "OUTPUT":
            constraints.append(out == a)  # simply out == a
        else:
            raise ValueError(f"Unknown gate type: {gate.type}")
        
    # print("Fixed inputs raw:", circuit.fixed_inputs, type(circuit.fixed_inputs))
    # Add fixed input values
    if isinstance(circuit.fixed_inputs, dict) and any(circuit.fixed_inputs):
        # print("inputs")
        for name, value in circuit.fixed_inputs.items():
            if name in variables:
                constraints.append(variables[name] == value)

    # Add fixed output values
    if isinstance(circuit.fixed_outputs, dict) and circuit.fixed_outputs:
        # print("outputs")
        for name, value in circuit.fixed_outputs.items():
            if name in variables:
                constraints.append(variables[name] == value)
        
    return variables, constraints