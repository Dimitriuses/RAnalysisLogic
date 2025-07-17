# Модель очікуваного входу
from typing import Dict, List, Optional
from pydantic import BaseModel


class LogicGate(BaseModel):
    id: str
    type: str  # "AND", "OR", "XOR", "NOT", etc.
    inputs: List[str]
    # output: str

class LogicCircuit(BaseModel):
    inputs: List[str]
    outputs: List[str]
    gates: List[LogicGate]
    fixed_inputs: Optional[Dict[str, bool]] = None,
    fixed_outputs: Optional[Dict[str, bool]] = None
