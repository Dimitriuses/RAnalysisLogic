from typing import Dict, Optional
from z3 import Xor, Bool, And, Or, Not, Solver, BoolRef

from PyZ3Server.clasess import LogicCircuit

def convert_to_z3(
    circuit: LogicCircuit,
    
):
    # Створюємо усі змінні
    variables: Dict[str, BoolRef] = {}

    # Спочатку вхідні
    for name in circuit.inputs:
        variables[name] = Bool(name)
        # print(name)

    # Потім проміжні та вихідні
    for gate in circuit.gates:
        for name in gate.inputs + [gate.id]:
            # print(name)
            if name not in variables:
                variables[name] = Bool(name)
                # print(name)
    constraints = []
    for gate in circuit.gates:
        if(gate.type == 'INPUT'): continue
        a = variables[gate.inputs[0]]
        b = variables[gate.inputs[1]] if len(gate.inputs) > 1 else None
        out = variables[gate.id]
        
        if gate.type == "XOR":
            constraints.append(out == Xor(a, b))
        elif gate.type == "AND":
            constraints.append(out == And(a, b))
        elif gate.type == "OR":
            constraints.append(out == Or(a, b))
        elif gate.type == "NOT":
            constraints.append(out == Not(a))
        elif gate.type == "OUTPUT":
            constraints.append(out == a)
        else:
            raise ValueError(f"Невідомий тип: {gate.type}")
        
    # print("Fixed inputs raw:", circuit.fixed_inputs, type(circuit.fixed_inputs))
    # Додаємо фіксовані значення входів
    if isinstance(circuit.fixed_inputs, dict) and any(circuit.fixed_inputs):
        # print("inputs")
        for name, value in circuit.fixed_inputs.items():
            if name in variables:
                constraints.append(variables[name] == value)

    # Додаємо фіксовані значення виходів
    if isinstance(circuit.fixed_outputs, dict) and circuit.fixed_outputs:
        # print("outputs")
        for name, value in circuit.fixed_outputs.items():
            if name in variables:
                constraints.append(variables[name] == value)
        
    return variables, constraints