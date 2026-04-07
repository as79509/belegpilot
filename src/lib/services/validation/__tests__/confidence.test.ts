import { describe, it, expect } from "vitest";
import {
  computeCompositeConfidence,
  computeFieldCompleteness,
  buildConfidenceFactors,
} from "../confidence";
import type { CanonicalAccountingData } from "@/lib/types/canonical";

describe("computeCompositeConfidence", () => {
  it("alle Faktoren 1.0 → nahe 1.0", () => {
    const result = computeCompositeConfidence({
      aiConfidence: 1.0,
      fieldCompleteness: 1.0,
      validationPassRate: 1.0,
      supplierMatchCertainty: 1.0,
    });
    expect(result).toBe(1.0);
  });

  it("alle Faktoren 0 → 0", () => {
    const result = computeCompositeConfidence({
      aiConfidence: 0,
      fieldCompleteness: 0,
      validationPassRate: 0,
      supplierMatchCertainty: 0,
    });
    expect(result).toBe(0);
  });

  it("validationPassRate hat 35% Gewicht (höchsten Einfluss)", () => {
    const onlyValidation = computeCompositeConfidence({
      aiConfidence: 0, fieldCompleteness: 0, validationPassRate: 1.0, supplierMatchCertainty: 0,
    });
    const onlyAi = computeCompositeConfidence({
      aiConfidence: 1.0, fieldCompleteness: 0, validationPassRate: 0, supplierMatchCertainty: 0,
    });
    expect(onlyValidation).toBeGreaterThan(onlyAi);
    expect(onlyValidation).toBe(0.35);
    expect(onlyAi).toBe(0.25);
  });
});

describe("computeFieldCompleteness", () => {
  it("vollständiges Dokument → nahe 1.0", () => {
    const doc: CanonicalAccountingData = {
      supplierNameRaw: "Test", supplierNameNormalized: "Test",
      documentType: "invoice", invoiceNumber: "INV-1",
      invoiceDate: new Date(), dueDate: new Date(),
      currency: "CHF", netAmount: 100, vatAmount: 8, grossAmount: 108,
      vatRatesDetected: [], iban: "CH123", paymentReference: "REF",
      expenseCategory: "A", accountCode: "6300", costCenter: "100",
    };
    const result = computeFieldCompleteness(doc);
    expect(result).toBe(1.0);
  });

  it("leeres Dokument → niedrig", () => {
    const doc: CanonicalAccountingData = {
      supplierNameRaw: null, supplierNameNormalized: null,
      documentType: "other", invoiceNumber: null,
      invoiceDate: null, dueDate: null,
      currency: null, netAmount: null, vatAmount: null, grossAmount: null,
      vatRatesDetected: null, iban: null, paymentReference: null,
      expenseCategory: null, accountCode: null, costCenter: null,
    };
    const result = computeFieldCompleteness(doc);
    expect(result).toBeLessThan(0.2);
  });
});
