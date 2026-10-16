import { create } from 'zustand';

export interface QCThresholds {
  id: string;
  ahMin: number;
  ahMax: number;
  irMin: number;
  irMax: number;
  version?: string;
  name?: string;
  isModelBased?: boolean;
}

export interface TestResult {
  machineSerial: string;
  normalizedSerial: string;
  cellSerial: string; // Matched serial or 'UNMATCHED'
  confidence: number;
  ahValue: number;
  irValue: number;
  grade?: string;
  isAlreadyTested: boolean;
  qcPrediction?: "PASS" | "FAIL" | "RETEST" | "HOLD" | "incomplete";
}

interface TestingState {
  results: TestResult[];
  thresholds: QCThresholds | null;
  isLoading: boolean;
  isApplying: boolean;
  
  setResults: (results: TestResult[]) => void;
  setThresholds: (thresholds: QCThresholds) => void;
  updateResult: (machineSerial: string, updates: Partial<TestResult>) => void;
  clearResults: () => void;
  setIsLoading: (loading: boolean) => void;
  setIsApplying: (applying: boolean) => void;
}

export const useTestingStore = create<TestingState>((set) => ({
  results: [],
  thresholds: null,
  isLoading: false,
  isApplying: false,

  setResults: (results) => set({ results }),
  setThresholds: (thresholds) => set({ thresholds }),
  updateResult: (machineSerial, updates) => set((state) => ({
    results: state.results.map((r) => 
      r.machineSerial === machineSerial ? { ...r, ...updates } : r
    )
  })),
  clearResults: () => set({ results: [] }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsApplying: (isApplying) => set({ isApplying }),
}));
