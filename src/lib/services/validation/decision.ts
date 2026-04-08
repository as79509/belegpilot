import type { ValidationResult } from "./validation-engine";

export type ProcessingDecisionResult = "auto_ready" | "needs_review" | "failed";

export function makeProcessingDecision(
  validationResult: ValidationResult,
  compositeConfidence: number,
  escalations?: string[]
): ProcessingDecisionResult {
  // Hard escalations always force review
  if (escalations && escalations.length > 0) return "needs_review";
  if (validationResult.errorCount > 0) return "needs_review";
  if (compositeConfidence < 0.65) return "needs_review";
  if (validationResult.warningCount > 3) return "needs_review";
  return "auto_ready";
}
