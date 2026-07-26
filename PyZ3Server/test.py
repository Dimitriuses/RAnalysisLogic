from z3 import And, Bool, Solver

a = Bool("a")
b = Bool("b")
c = Bool("c")

# For example: c = a AND b
expr = c == And(a, b)

solver = Solver()
solver.add(expr)

print(solver.check())
print(solver.model())

# fixed_outputs = {"outputZ": True}
# print()

import time

from tqdm import tqdm

for i in tqdm(range(100)):
    time.sleep(0.05)  # Simulating a task