// Stub for Phase 10.1.3 — Banana Round Trip Import
// Will be fully implemented in the next phase.

export interface RoundTripResult {
  totalRows: number;
  matched: number;
  modified: number;
  newInBanana: number;
  unmatched: number;
  importBatchId: string;
  deltas: Array<{
    journalEntryId: string | null;
    field: string;
    bpValue: string | null;
    bananaValue: string | null;
  }>;
  learnSignals: Array<{
    type: string;
    message: string;
    frequency: number;
    suggestRuleUpdate: boolean;
  }>;
}

// Alias for API route compatibility
export const importBananaFile = importBananaRoundTrip;

export async function importBananaRoundTrip(
  _companyId: string,
  _csvContent: string
): Promise<RoundTripResult> {
  return {
    totalRows: 0,
    matched: 0,
    modified: 0,
    newInBanana: 0,
    unmatched: 0,
    importBatchId: "",
    deltas: [],
    learnSignals: [],
  };
}
