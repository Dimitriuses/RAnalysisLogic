import sys
import os

# & "C:\Program Files\Python310\python.exe" -m uvicorn PyZ3Server.server:app --reload
# sys.path.append(os.path.dirname(__file__))  # Додай поточну папку в шлях

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Union

from PyZ3Server.clasess import LogicCircuit
from PyZ3Server.parcer import convert_to_z3
from PyZ3Server.solver import solve_all, solve_circuit

app = FastAPI()

origins = [
    "http://localhost:5173",  # або порт, який ти використовуєш у Vite
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Можна поставити ["*"] для всіх джерел (небажано в продакшені)
    allow_credentials=True,
    allow_methods=["*"],  # Дозволити всі методи: GET, POST, OPTIONS, і т.д.
    allow_headers=["*"],  # Дозволити будь-які заголовки
)

# print(dir(z3))

@app.post("/simulate")
def simulate_logic(circuit: LogicCircuit):
    # print(circuit)
    try:
        # TODO: Парсинг у Z3 / SMT тут
        return {
            "message": "Прийнято", 
            "gates_count": len(circuit.gates),
            "data": convert_to_z3(circuit)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@app.post("/solve")
def solve_logic_circuit(circuit: LogicCircuit):
    variables, constraints = convert_to_z3(circuit)
    # print("w to r")
    # result = solve_circuit(variables, constraints)
    result = solve_all(variables, constraints)
    if result is None:
        return {"status": "unsat", "solution": None}
    else:
        return {"status": "sat", "solution": result}

