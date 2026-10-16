import math

def evaluate_qc_cell(ah: float, ir: float, config: dict) -> str:
    """
    Industrial QC Decision Engine for battery cells in Python.
    Enforces impossible value bounds, hard fail limits, retest ranges, and standard pass bands.
    """
    # 1. QC HOLD: Impossible Readings or Corrupted Data
    if (
        ah is None or 
        ir is None or 
        math.isnan(ah) or 
        math.isnan(ir) or
        ah <= 0 or 
        ir <= 0 or 
        ah > 1000 or 
        ir > 500
    ):
        return "HOLD"

    ah_min = float(config.get("ahMin", 3.2))
    ah_max = float(config.get("ahMax", 3.5))
    ir_min = float(config.get("irMin", 5.0))
    ir_max = float(config.get("irMax", 65.0))
    retest_ah_margin = float(config.get("retestAhMargin", 0.1))
    retest_ir_margin = float(config.get("retestIrMargin", 2.0))
    hard_fail_ah = float(config.get("hardFailAh", 3.0))
    hard_fail_ir = float(config.get("hardFailIr", 70.0))

    # 2. QC FAIL: Severe Out-of-Range values (Hard Fail)
    if ah < hard_fail_ah or ir > hard_fail_ir:
        return "FAIL"

    # 3. QC RETEST: Borderline zones
    if (
        (ah >= (ah_min - retest_ah_margin) and ah < ah_min) or
        (ir > ir_max and ir <= (ir_max + retest_ir_margin))
    ):
        return "RETEST"

    # 4. QC PASS: Valid industrial specifications
    if ah >= ah_min and ah <= ah_max and ir >= ir_min and ir <= ir_max:
        return "PASS"

    # Default fallback for any other cases
    return "FAIL"

def calculate_grade(ah: float, ir: float) -> str:
    """
    Battery Cell Quality Grading logic in Python.
    """
    if ah is None or ir is None or math.isnan(ah) or math.isnan(ir) or ah <= 0 or ir <= 0:
        return "C"
    if ah >= 3.35 and ir <= 55:
        return "A+"
    if ah >= 3.20 and ir <= 65:
        return "A"
    if ah >= 3.05 and ir <= 70:
        return "B+"
    if ah >= 2.90 and ir <= 75:
        return "B"
    if ah >= 2.70 and ir <= 80:
        return "C+"
    return "C"
