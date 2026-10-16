import * as path from "path";
import * as fs from "fs";
import { evaluateQcCell as evaluateBackendQc, calculateGrade as calculateBackendGrade, QcConfig } from "../domain/qc/qcRules";

// Dynamically load and transpile frontend qcRules to avoid TypeScript cross-rootDir compilation violation
const frontendQcRulesPath = path.resolve(__dirname, "../../../frontend/src/lib/qcRules.ts");
if (!fs.existsSync(frontendQcRulesPath)) {
  throw new Error(`Frontend QC rules file not found at: ${frontendQcRulesPath}`);
}
const frontendSource = fs.readFileSync(frontendQcRulesPath, "utf-8");

// Transpile TypeScript frontend code to CommonJS dynamically
const ts = require("typescript");
const transpiledJs = ts.transpileModule(frontendSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

const frontendExports: any = {};
const moduleWrapper = new Function("exports", "require", transpiledJs);
moduleWrapper(frontendExports, require);

const evaluateFrontendQc = frontendExports.evaluateQcCell;
const calculateFrontendGrade = frontendExports.calculateGrade;

const testConfig: QcConfig = {
  ahMin: 3.20,
  ahMax: 3.50,
  irMin: 5.0,
  irMax: 65.0,
  retestAhMargin: 0.10,
  retestIrMargin: 2.0,
  hardFailAh: 3.00,
  hardFailIr: 75.0,
};

interface TestCase {
  name: string;
  ah: number | null | undefined;
  ir: number | null | undefined;
  expectedDecision: "PASS" | "FAIL" | "RETEST" | "HOLD";
  expectedGrade?: string;
}

const testCases: TestCase[] = [
  // 1. Valid PASS specifications
  { name: "Optimal Grade A+ Cell", ah: 3.40, ir: 45.0, expectedDecision: "PASS", expectedGrade: "A+" },
  { name: "Exact Min Specs Grade A Cell", ah: 3.20, ir: 65.0, expectedDecision: "PASS", expectedGrade: "A" },
  { name: "Exact Max Specs Cell", ah: 3.50, ir: 5.0, expectedDecision: "PASS", expectedGrade: "A+" },
  { name: "Mid-range PASS Cell", ah: 3.30, ir: 50.0, expectedDecision: "PASS", expectedGrade: "A" },

  // 2. Severe Out-of-Range Hard Fails (Precedence #2)
  { name: "Hard Fail Capacity", ah: 2.95, ir: 50.0, expectedDecision: "FAIL", expectedGrade: "B" },
  { name: "Hard Fail Internal Resistance", ah: 3.30, ir: 76.0, expectedDecision: "FAIL", expectedGrade: "C+" },
  { name: "Double Hard Fail", ah: 2.80, ir: 85.0, expectedDecision: "FAIL", expectedGrade: "C" },

  // 3. Borderline Screening RETEST cases (Precedence #3)
  { name: "Borderline Lower Ah Retest", ah: 3.15, ir: 50.0, expectedDecision: "RETEST", expectedGrade: "B+" },
  { name: "Borderline Upper Ah Retest", ah: 3.55, ir: 50.0, expectedDecision: "RETEST", expectedGrade: "A+" },
  { name: "Borderline Upper IR Retest", ah: 3.30, ir: 66.5, expectedDecision: "RETEST", expectedGrade: "B+" },
  { name: "Borderline Lower IR Retest", ah: 3.30, ir: 4.0, expectedDecision: "RETEST", expectedGrade: "A" },

  // 4. Out-of-spec but within physical limits (Precedence #5)
  { name: "Above Upper Ah Retest Margin", ah: 3.65, ir: 50.0, expectedDecision: "FAIL", expectedGrade: "A+" },
  { name: "Above Upper IR Retest Margin", ah: 3.30, ir: 70.0, expectedDecision: "FAIL", expectedGrade: "B+" },

  // 5. Impossible / Missing / Corrupt Telemetry -> HOLD (Precedence #1)
  { name: "Null Capacity Reading", ah: null, ir: 50.0, expectedDecision: "HOLD", expectedGrade: "C" },
  { name: "Undefined IR Reading", ah: 3.30, ir: undefined, expectedDecision: "HOLD", expectedGrade: "C" },
  { name: "NaN Capacity", ah: NaN, ir: 50.0, expectedDecision: "HOLD", expectedGrade: "C" },
  { name: "Negative IR", ah: 3.30, ir: -5.0, expectedDecision: "HOLD", expectedGrade: "C" },
  { name: "Zero Capacity", ah: 0, ir: 50.0, expectedDecision: "HOLD", expectedGrade: "C" },
  { name: "Excessive Capacity Spike (>1000 Ah)", ah: 1500, ir: 50.0, expectedDecision: "HOLD", expectedGrade: "A+" },
  { name: "Excessive IR Spike (>500 mOhm)", ah: 3.30, ir: 650, expectedDecision: "HOLD", expectedGrade: "C" },
  { name: "Infinity Capacity", ah: Infinity, ir: 50.0, expectedDecision: "HOLD", expectedGrade: "C" },
];

function runParityTests() {
  console.log("================================================================================");
  console.log("⚡ KYRA ZAM 2.0 — QC Decision & Grading Mathematical Parity Test Suite");
  console.log("Comparing Backend (backend/src/domain/qc) vs Frontend (frontend/src/lib/qcRules)");
  console.log("================================================================================\n");

  let passedCount = 0;
  let failedCount = 0;

  for (const tc of testCases) {
    const backendDecision = evaluateBackendQc(tc.ah, tc.ir, testConfig);
    const frontendDecision = evaluateFrontendQc(tc.ah, tc.ir, testConfig);

    const backendGrade = tc.ah != null && tc.ir != null ? calculateBackendGrade(tc.ah, tc.ir) : "C";
    const frontendGrade = tc.ah != null && tc.ir != null ? calculateFrontendGrade(tc.ah, tc.ir) : "C";

    const decisionParity = backendDecision === frontendDecision;
    const gradeParity = backendGrade === frontendGrade;
    const expectedDecisionMatch = backendDecision === tc.expectedDecision;
    const expectedGradeMatch = tc.expectedGrade ? backendGrade === tc.expectedGrade : true;

    if (decisionParity && gradeParity && expectedDecisionMatch && expectedGradeMatch) {
      console.log(`✅ [PASS] ${tc.name.padEnd(42)} => Decision: ${backendDecision.padEnd(6)} | Grade: ${backendGrade}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${tc.name}`);
      console.error(`   Decision => Expected: ${tc.expectedDecision}, Backend: ${backendDecision}, Frontend: ${frontendDecision}`);
      console.error(`   Grade    => Expected: ${tc.expectedGrade}, Backend: ${backendGrade}, Frontend: ${frontendGrade}`);
      failedCount++;
    }
  }

  console.log("\n================================================================================");
  console.log(`Results: ${passedCount} passed, ${failedCount} failed out of ${testCases.length} total test cases.`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runParityTests();
