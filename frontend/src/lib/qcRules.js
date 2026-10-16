"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateQcCell = evaluateQcCell;
exports.calculateGrade = calculateGrade;
/**
 * Frontend UI Preview & Inline Validation QC Decision Engine for battery cells.
 * Enforces impossible value bounds, hard fail limits, retest ranges, and standard pass bands.
 *
 * Precedence:
 * 1. Invalid / Physically impossible telemetry -> HOLD
 * 2. Severe Out-of-Range Hard Failure -> FAIL
 * 3. Borderline screening boundary -> RETEST
 * 4. Normal within-spec bounds -> PASS
 * 5. Out-of-spec but within physical telemetry -> FAIL
 */
function evaluateQcCell(ah, ir, config) {
    // 1. QC HOLD: Impossible Readings or Corrupted/Missing Data (Precedence #1)
    if (ah === null ||
        ah === undefined ||
        ir === null ||
        ir === undefined ||
        isNaN(ah) ||
        isNaN(ir) ||
        !isFinite(ah) ||
        !isFinite(ir) ||
        ah <= 0 ||
        ah > 1000 ||
        ir <= 0 ||
        ir > 500) {
        return "HOLD";
    }
    const { ahMin, ahMax, irMin, irMax, retestAhMargin, retestIrMargin, hardFailAh, hardFailIr } = config;
    // 2. QC FAIL: Severe Out-of-Range Hard Failure (Precedence #2 over retest)
    if (ah < hardFailAh || ir > hardFailIr) {
        return "FAIL";
    }
    // 3. QC RETEST: Borderline screening zones (Precedence #3)
    // - Lower AH Borderline: [ahMin - retestAhMargin, ahMin)
    // - Upper AH Borderline: (ahMax, ahMax + retestAhMargin]
    // - Upper IR Borderline: (irMax, irMax + retestIrMargin]
    // - Lower IR Borderline: [max(1.0, irMin - retestIrMargin), irMin)
    const isAhLowerRetest = ah >= (ahMin - retestAhMargin) && ah < ahMin;
    const isAhUpperRetest = ah > ahMax && ah <= (ahMax + retestAhMargin);
    const isIrUpperRetest = ir > irMax && ir <= (irMax + retestIrMargin);
    const isIrLowerRetest = ir >= Math.max(1.0, irMin - retestIrMargin) && ir < irMin;
    if (isAhLowerRetest || isAhUpperRetest || isIrUpperRetest || isIrLowerRetest) {
        return "RETEST";
    }
    // 4. QC PASS: Valid industrial specifications (Precedence #4)
    if (ah >= ahMin && ah <= ahMax && ir >= irMin && ir <= irMax) {
        return "PASS";
    }
    // 5. Default Fallback for all other out-of-range telemetry (Precedence #5)
    // (e.g. AH > ahMax + retestAhMargin or IR < irMin - retestIrMargin)
    return "FAIL";
}
/**
 * Battery Cell Quality Grading logic for frontend display and badge formatting.
 * Grade is purely a classification of cell quality and does not replace the QC PASS/FAIL decision.
 */
function calculateGrade(ah, ir) {
    if (isNaN(ah) || isNaN(ir) || !isFinite(ah) || !isFinite(ir) || ah <= 0 || ir <= 0)
        return "C";
    if (ah >= 3.35 && ir <= 55)
        return "A+";
    if (ah >= 3.20 && ir <= 65)
        return "A";
    if (ah >= 3.05 && ir <= 70)
        return "B+";
    if (ah >= 2.90 && ir <= 75)
        return "B";
    if (ah >= 2.70 && ir <= 80)
        return "C+";
    return "C";
}
