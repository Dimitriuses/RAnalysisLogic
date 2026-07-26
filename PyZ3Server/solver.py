from tqdm import tqdm
from z3 import BoolRef, Or, Solver, sat


def solve_circuit(variables: dict[str, BoolRef], constraints: list[BoolRef]):
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
    
def solve_all(variables: dict[str, BoolRef], constraints: list[BoolRef]):
    solver = Solver()
    solver.add(constraints)
    models = get_all_models(solver, variables)
    out = []
    for model in tqdm(models):
        out.append({str(var): bool(model[var]) if model[var] is not None else None for var in variables.values()})
    return out if out else None

def get_all_models(solver, variables):
    models = []
    for i in tqdm(range(1000)):
        if solver.check() != sat: break
        model = solver.model()
        models.append(model)
        # Build a constraint that excludes the current model
        block = []
        for var in variables:
            val = model.eval(variables[var], model_completion=True)
            block.append(variables[var] != val)
        solver.add(Or(block))  # exclude the current combination
    return models