import type { CanonicalAccountingData } from "@/lib/types/canonical";
import type { ValidationResult } from "./validation-engine";

export interface ConfidenceFactors {
  aiConfidence: number;
  fieldCompleteness: number;
  validationPassRate: number;
  supplierMatchCertainty: number;
}

const CANONICAL_FIELDS: (keyof CanonicalAccountingData)[] = [
  "supplierNameRaw",
  "documentType",
  "invoiceNumber",
  "invoiceDate",
  "currency",
  "netAmount",
  "vatAmount",
  "grossAmount",
  "iban",
];

export function computeFieldCompleteness(
  canonical: CanonicalAccountingData
): number {
  const filled = CANONICAL_FIELDS.filter((f) => {
    const v = canonical[f];
    return v != null && v !== "" && v !== "other";
  }).length;
  return filled / CANONICAL_FIELDS.length;
}

export function computeCompositeConfidence(
  factors: ConfidenceFactors
): number {
  const score =
    factors.aiConfidence * 0.25 +
    factors.fieldCompleteness * 0.25 +
    factors.validationPassRate * 0.35 +
    factors.supplierMatchCertainty * 0.15;
  return Math.round(score * 100) / 100;
}

export function buildConfidenceFactors(
  aiConfidence: number,
  canonical: CanonicalAccountingData,
  validationResult: ValidationResult,
  supplierMatchCertainty: number = 0
): ConfidenceFactors {
  const totalChecks = validationResult.checks.length;
  const passedChecks = validationResult.checks.filter((c) => c.passed).length;

  return {
    aiConfidence,
    fieldCompleteness: computeFieldCompleteness(canonical),
    validationPassRate: totalChecks > 0 ? passedChecks / totalChecks : 0,
    supplierMatchCertainty,
  };
}
