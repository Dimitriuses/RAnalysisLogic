from z3 import BoolRef, Or, Solver, sat

# How many distinct models solve_all will enumerate before giving up. The
# blocking-clause loop below is linear in this, and each iteration is a full
# solver call, so this is the knob that keeps a large circuit from hanging a
# request rather than a limit anyone has hit deliberately.
MAX_MODELS = 1000


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
    out = [
        {str(var): bool(model[var]) if model[var] is not None else None for var in variables.values()}
        for model in models
    ]
    return out if out else None

def get_all_models(solver, variables):
    models = []
    for _ in range(MAX_MODELS):
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