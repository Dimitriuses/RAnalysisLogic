from z3 import Bool, And, Or, Not, Solver

a = Bool("a")
b = Bool("b")
c = Bool("c")

# Наприклад: c = a AND b
expr = c == And(a, b)

solver = Solver()
solver.add(expr)

print(solver.check())
print(solver.model())

# fixed_outputs = {"outputZ": True}
# print()

from tqdm import tqdm
import time

for i in tqdm(range(100)):
    time.sleep(0.05)  # Simulating a task