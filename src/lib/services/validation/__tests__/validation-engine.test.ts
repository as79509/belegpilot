import { describe, it, expect } from "vitest";
import { validateDocument } from "../validation-engine";
import type { CanonicalAccountingData } from "@/lib/types/canonical";

function makeDoc(overrides: Partial<CanonicalAccountingData> = {}): CanonicalAccountingData {
  return {
    supplierNameRaw: "Test GmbH",
    supplierNameNormalized: "Test",
    documentType: "invoice",
    invoiceNumber: "INV-001",
    invoiceDate: new Date("2025-04-01"),
    dueDate: new Date("2025-04-30"),
    currency: "CHF",
    netAmount: 100,
    vatAmount: 8.1,
    grossAmount: 108.1,
    vatRatesDetected: [{ rate: 8.1, amount: 8.1 }],
    iban: "CH1234567890",
    paymentReference: "REF-001",
    expenseCategory: "Büro",
    accountCode: "6300",
    costCenter: "100",
    ...overrides,
  };
}

describe("validateDocument", () => {
  it("vollständiges Dokument → overallPassed true, 0 errors", () => {
    const result = validateDocument(makeDoc());
    expect(result.overallPassed).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("erkennt Math-Inkonsistenz (netto + mwst ≠ brutto)", () => {
    const doc = makeDoc({ netAmount: 100, vatAmount: 10, grossAmount: 200 });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "math_consistency");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("toleriert kleine Differenz (0.03 CHF)", () => {
    const doc = makeDoc({ netAmount: 100, vatAmount: 8.1, grossAmount: 108.13 });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "math_consistency");
    expect(check?.passed).toBe(true);
  });

  it("erkennt fehlenden Bruttobetrag", () => {
    const doc = makeDoc({ grossAmount: null });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "gross_amount_present");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("erkennt ungültige Währung", () => {
    const doc = makeDoc({ currency: "XYZ" });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "currency_valid");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
  });

  it("warnt bei Rechnungsdatum in der Zukunft", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const doc = makeDoc({ invoiceDate: future });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "invoice_date_plausible");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("warning");
  });

  it("warnt bei Rechnungsdatum älter als 2 Jahre", () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 3);
    const doc = makeDoc({ invoiceDate: old });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "invoice_date_plausible");
    expect(check?.passed).toBe(false);
  });

  it("warnt wenn Fälligkeitsdatum vor Rechnungsdatum", () => {
    const doc = makeDoc({
      invoiceDate: new Date("2025-04-30"),
      dueDate: new Date("2025-04-01"),
    });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "due_date_after_invoice");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("warning");
  });

  it("warnt bei fehlendem Lieferantennamen", () => {
    const doc = makeDoc({ supplierNameRaw: null });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "supplier_name_present");
    expect(check?.passed).toBe(false);
  });

  it("warnt bei fehlender Rechnungsnummer", () => {
    const doc = makeDoc({ invoiceNumber: null });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "invoice_number_present");
    expect(check?.passed).toBe(false);
  });

  it("erkennt Duplikat mit metadata.duplicateDocumentId", () => {
    const doc = makeDoc();
    const existing = [
      { id: "dup-id-123", supplierNameNormalized: "Test", invoiceNumber: "INV-001", grossAmount: 108.1 },
    ];
    const result = validateDocument(doc, existing);
    const check = result.checks.find((c) => c.checkName === "duplicate_by_fields");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("error");
    expect(check?.metadata?.duplicateDocumentId).toBe("dup-id-123");
  });

  it("kein Duplikat wenn keine Übereinstimmung", () => {
    const doc = makeDoc();
    const existing = [
      { id: "other-id", supplierNameNormalized: "Other", invoiceNumber: "INV-999", grossAmount: 999 },
    ];
    const result = validateDocument(doc, existing);
    const check = result.checks.find((c) => c.checkName === "duplicate_by_fields");
    expect(check?.passed).toBe(true);
  });

  it("warnt bei ungewöhnlich hohem Betrag (>50000)", () => {
    const doc = makeDoc({ grossAmount: 75000 });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "amount_plausible");
    expect(check?.passed).toBe(false);
  });

  it("warnt bei Betrag = 0", () => {
    const doc = makeDoc({ grossAmount: 0 });
    const result = validateDocument(doc);
    const check = result.checks.find((c) => c.checkName === "amount_plausible");
    expect(check?.passed).toBe(false);
  });
});
