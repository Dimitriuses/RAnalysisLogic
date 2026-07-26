# Model of the expected request payload
from pydantic import BaseModel


class LogicGate(BaseModel):
    id: str
    type: str  # "AND", "OR", "XOR", "NOT", etc.
    inputs: list[str]
    # output: str

class LogicCircuit(BaseModel):
    inputs: list[str]
    outputs: list[str]
    gates: list[LogicGate]
    fixed_inputs: dict[str, bool] | None = None
    fixed_outputs: dict[str, bool] | None = None
    # False (default): return just one satisfying assignment (fast, safe for
    # large circuits). True: enumerate up to 1000 distinct solutions.
    find_all_solutions: bool = False

class ModuleData(BaseModel):
    id: str
    nodes: list[LogicGate]
    inputs: list[str]
    outputs: list[str]