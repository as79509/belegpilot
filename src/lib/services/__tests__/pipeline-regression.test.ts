import { describe, it, expect } from "vitest";
import { validateDocument } from "../validation/validation-engine";
import { makeProcessingDecision } from "../validation/decision";

function makeDoc(overrides: Record<string, any> = {}) {
  return {
    supplierNameRaw: "Test AG",
    supplierNameNormalized: "Test",
    documentType: "invoice",
    invoiceNumber: "INV-001",
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 86400000),
    currency: "CHF",
    netAmount: 100,
    vatAmount: 8.1,
    grossAmount: 108.1,
    vatRatesDetected: [{ rate: 8.1, amount: 8.1 }],
    iban: "CH93 0076 2011 6238 5295 7",
    paymentReference: "REF-001",
    expenseCategory: "Büromaterial",
    accountCode: "6500",
    costCenter: "100",
    ...overrides,
  };
}

describe("Decision Pipeline Regression Tests", () => {
  it("neuer Lieferant mit hoher Confidence + Eskalation → needs_review", () => {
    const result = makeProcessingDecision(
      { checks: [], overallPassed: true, errorCount: 0, warningCount: 0 },
      0.95,
      ["Neuer Lieferant"]
    );
    expect(result).toBe("needs_review");
  });

  it("hohe Confidence + keine Eskalation + keine Fehler → auto_ready", () => {
    const result = makeProcessingDecision(
      { checks: [], overallPassed: true, errorCount: 0, warningCount: 1 },
      0.92,
      []
    );
    expect(result).toBe("auto_ready");
  });

  it("mandantenspezifischer Threshold 0.9 → needs_review bei 0.85", () => {
    const result = makeProcessingDecision(
      { checks: [], overallPassed: true, errorCount: 0, warningCount: 0 },
      0.85,
      [],
      0.9
    );
    expect(result).toBe("needs_review");
  });

  it("niedrige Confidence ohne Eskalation → needs_review", () => {
    const result = makeProcessingDecision(
      { checks: [], overallPassed: true, errorCount: 0, warningCount: 0 },
      0.30,
      []
    );
    expect(result).toBe("needs_review");
  });

  it("Validierungsfehler → needs_review trotz hoher Confidence", () => {
    const result = makeProcessingDecision(
      { checks: [], overallPassed: false, errorCount: 2, warningCount: 0 },
      0.95,
      []
    );
    expect(result).toBe("needs_review");
  });

  it(">3 Warnungen → needs_review", () => {
    const result = makeProcessingDecision(
      { checks: [], overallPassed: true, errorCount: 0, warningCount: 4 },
      0.90,
      []
    );
    expect(result).toBe("needs_review");
  });

  it("Standard-Dokument besteht alle Validierungen", () => {
    const doc = makeDoc();
    const result = validateDocument(doc);
    expect(result.errorCount).toBe(0);
    expect(result.overallPassed).toBe(true);
  });

  it("Auslandsbeleg (DKK) validiert Währung korrekt", () => {
    const doc = makeDoc({ currency: "DKK" });
    const result = validateDocument(doc);
    const currencyCheck = result.checks.find((c) => c.checkName === "currency_valid");
    expect(currencyCheck?.passed).toBe(true);
  });

  it("ungültige Währung wird erkannt", () => {
    const doc = makeDoc({ currency: "XYZ" });
    const result = validateDocument(doc);
    const currencyCheck = result.checks.find((c) => c.checkName === "currency_valid");
    expect(currencyCheck?.passed).toBe(false);
    expect(currencyCheck?.severity).toBe("error");
  });

  it("fehlender Bruttobetrag ist ein Fehler", () => {
    const doc = makeDoc({ grossAmount: null, netAmount: null, vatAmount: null });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "gross_amount_present");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("Math-Inkonsistenz Netto+MwSt != Brutto wird erkannt", () => {
    const doc = makeDoc({ netAmount: 100, vatAmount: 10, grossAmount: 200 });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "math_consistency");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("Betrag genau 50000 → amount_plausible check", () => {
    const doc = makeDoc({
      netAmount: 46296,
      vatAmount: 3704,
      grossAmount: 50000,
    });
    const result = validateDocument(doc);
    const amountCheck = result.checks.find((c) => c.checkName === "amount_plausible");
    expect(amountCheck).toBeDefined();
    // 50000 is not > 50000, so it passes
    expect(amountCheck?.passed).toBe(true);
  });

  it("Betrag > 50000 → ungewöhnlich hoch", () => {
    const doc = makeDoc({
      netAmount: 50000,
      vatAmount: 4050,
      grossAmount: 54050,
    });
    const result = validateDocument(doc);
    const amountCheck = result.checks.find((c) => c.checkName === "amount_plausible");
    expect(amountCheck?.passed).toBe(false);
  });

  it("Duplikat-Erkennung findet gleichen Lieferant + Rechnungsnr + Betrag", () => {
    const doc = makeDoc();
    const existing = [{ id: "existing-1", supplierNameNormalized: "Test", invoiceNumber: "INV-001", grossAmount: 108.1 }];
    const result = validateDocument(doc, existing);
    const dupCheck = result.checks.find((c) => c.checkName === "duplicate_by_fields");
    expect(dupCheck?.passed).toBe(false);
    expect(dupCheck?.metadata?.duplicateDocumentId).toBe("existing-1");
  });

  it("Rechnungsdatum in der Zukunft → Warnung", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const doc = makeDoc({ invoiceDate: futureDate });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "invoice_date_plausible");
    expect(check?.passed).toBe(false);
  });

  it("Fälligkeitsdatum vor Rechnungsdatum → Warnung", () => {
    const invoiceDate = new Date(2026, 3, 1);
    const dueDate = new Date(2026, 2, 1);
    const doc = makeDoc({ invoiceDate, dueDate });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "due_date_after_invoice");
    expect(check?.passed).toBe(false);
  });
});
