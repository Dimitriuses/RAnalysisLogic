from typing import Dict, List
from z3 import Solver, BoolRef, sat, Or

def solve_circuit(variables: Dict[str, BoolRef], constraints: List[BoolRef]):
    solver = Solver()
    solver.add(constraints)

    if solver.check() == sat:
        model = solver.model()
        return {
            str(var): bool(model[var]) if model[var] is not None else None
            for var in variables.values()
        }
    else:
        return None
    
def solve_all(variables: Dict[str, BoolRef], constraints: List[BoolRef]):
    solver = Solver()
    solver.add(constraints)
    models = get_all_models(solver, variables)
    out = {}

    for i, model in enumerate(models):
        mi = {str(var): bool(model[var]) if model[var] is not None else None for var in variables.values()}
        # for name in sorted(variables):
        #     {name} = {model.eval(variables[name], model_completion=True)}
        out[f"Model #{i + 1}"] = mi
    return out
    
def get_all_models(solver, variables):
    models = []
    while solver.check() == sat:
        if len(models) > 1000: break
        model = solver.model()
        models.append(model)

        # Створюємо обмеження, що виключає поточну модель
        block = []
        for var in variables:
            val = model.eval(variables[var], model_completion=True)
            block.append(variables[var] != val)
        solver.add(Or(block))  # виключаємо поточну комбінацію
    return models