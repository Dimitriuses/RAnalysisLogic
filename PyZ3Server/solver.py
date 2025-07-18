import time
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
    out = []
    # print(filter(lambda v: v, constraints))
    start = time.perf_counter()
    for i, model in enumerate(models):
        out.append({str(var): bool(model[var]) if model[var] is not None else None for var in variables.values()})
        print("\rmaping   ", i + 1, end="",)
        # print("".join(["1" if v else "0" for v in mi.values()]))
        # print({k: v for k, v in mi.items() if k.find("A") != -1 or k.find("B") != -1 or k.find("CIN") != -1})
        # for name in sorted(variables):
        #     {name} = {model.eval(variables[name], model_completion=True)}
        # out[f"Model #{i + 1}"] = mi
    end = time.perf_counter()
    print(f" {end - start:.6f}s")
    return out
    
def get_all_models(solver, variables):
    models = []
    start = time.perf_counter()
    while solver.check() == sat:
        if len(models) >= 1000: break
        model = solver.model()
        models.append(model)
        print("\rmodeling ", len(models), end="",)
        # Створюємо обмеження, що виключає поточну модель
        block = []
        for var in variables:
            val = model.eval(variables[var], model_completion=True)
            block.append(variables[var] != val)
        solver.add(Or(block))  # виключаємо поточну комбінацію
    end = time.perf_counter()
    print(f" {end - start:.6f}s")
    return models