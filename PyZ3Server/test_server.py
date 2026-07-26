from fastapi.testclient import TestClient

from PyZ3Server.server import app

client = TestClient(app)

# Bits 0-1 of the ripple-carry chain, copied verbatim (same wire numbers and
# gate types) from the first 7 gate lines of
# logic-sim/src/shared/64 Bit Adder.txt. Testing this slice through the real
# /solve and /truth-table endpoints exercises the actual adder wiring rather
# than a hand-rolled lookalike.
ADDER_SLICE_GATES = [
    {"id": "441", "type": "XOR", "inputs": ["63", "127"]},   # sum bit 0
    {"id": "129", "type": "AND", "inputs": ["63", "127"]},   # carry-generate 0
    {"id": "130", "type": "XOR", "inputs": ["62", "129"]},
    {"id": "440", "type": "XOR", "inputs": ["126", "130"]},  # sum bit 1
    {"id": "132", "type": "XOR", "inputs": ["126", "129"]},
    {"id": "133", "type": "AND", "inputs": ["130", "132"]},
    {"id": "134", "type": "XOR", "inputs": ["129", "133"]},  # carry out of bit 1
]
INPUTS = ["63", "127", "62", "126"]  # A0, B0, A1, B1
OUTPUTS = ["441", "440", "134"]      # sum0, sum1, carry-out


def expected_result(a0, b0, a1, b1):
    a_val = a0 + 2 * a1
    b_val = b0 + 2 * b1
    total = a_val + b_val
    return total & 1, (total >> 1) & 1, (total >> 2) & 1


class TestSolve:
    def test_fixed_inputs_returns_the_arithmetically_correct_sum(self):
        # A = 1 (A0=1, A1=0), B = 1 (B0=1, B1=0) -> total = 2 -> sum0=0, sum1=1, carry=0
        payload = {
            "inputs": INPUTS,
            "outputs": OUTPUTS,
            "gates": ADDER_SLICE_GATES,
            "fixed_inputs": {"63": True, "127": True, "62": False, "126": False},
        }
        response = client.post("/solve", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "sat"
        assert len(body["solution"]) == 1
        model = body["solution"][0]
        assert (model["441"], model["440"], model["134"]) == (False, True, False)

    def test_contradictory_fixed_inputs_and_outputs_are_unsat(self):
        payload = {
            "inputs": INPUTS,
            "outputs": OUTPUTS,
            "gates": ADDER_SLICE_GATES,
            "fixed_inputs": {"63": True, "127": True, "62": False, "126": False},
            "fixed_outputs": {"441": True},  # sum0 must be False for these inputs -> unsat
        }
        response = client.post("/solve", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "unsat"
        assert body["solution"] is None

    def test_fixed_outputs_enumerates_every_input_pair_with_that_sum(self):
        # target total = 2 (sum0=False, sum1=True, carry=False), A/B in 0..3:
        # (0,2), (1,1), (2,0) -> exactly 3 solutions
        payload = {
            "inputs": INPUTS,
            "outputs": OUTPUTS,
            "gates": ADDER_SLICE_GATES,
            "fixed_outputs": {"441": False, "440": True, "134": False},
        }
        response = client.post("/solve", json=payload)
        body = response.json()
        assert body["status"] == "sat"
        solutions = body["solution"]
        assert len(solutions) == 3

        seen_pairs = set()
        for model in solutions:
            a_val = model["63"] + 2 * model["62"]
            b_val = model["127"] + 2 * model["126"]
            assert a_val + b_val == 2
            seen_pairs.add((a_val, b_val))
        assert seen_pairs == {(0, 2), (1, 1), (2, 0)}


class TestTruthTable:
    def test_matches_arithmetic_addition_for_every_input_combination(self):
        payload = {
            "id": "adder-bits-0-1",
            "nodes": ADDER_SLICE_GATES,
            "inputs": INPUTS,
            "outputs": OUTPUTS,
        }
        response = client.post("/truth-table", json=payload)
        assert response.status_code == 200
        body = response.json()
        rows = body["table"]
        assert len(rows) == 16  # 2**4 input combinations

        for row in rows:
            a0, b0, a1, b1 = row["input"]
            expected = expected_result(a0, b0, a1, b1)
            got = tuple(row["output"])
            assert got == expected, row
