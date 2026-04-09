import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    supplier: { findFirst: vi.fn() },
    document: { count: vi.fn() },
  },
}));

vi.mock("@/lib/services/cockpit/period-guard", () => ({
  checkPeriodLock: vi.fn(),
}));

vi.mock("@/lib/services/suggestions/supplier-patterns", () => ({
  analyzeSupplierPatterns: vi.fn(),
}));

import { runSafetyChecks } from "../safety-check";
import { prisma } from "@/lib/db";
import { checkPeriodLock } from "@/lib/services/cockpit/period-guard";
import { analyzeSupplierPatterns } from "@/lib/services/suggestions/supplier-patterns";

const mockSupplierFindFirst = prisma.supplier.findFirst as ReturnType<typeof vi.fn>;
const mockDocumentCount = prisma.document.count as ReturnType<typeof vi.fn>;
const mockCheckPeriodLock = checkPeriodLock as ReturnType<typeof vi.fn>;
const mockAnalyzePatterns = analyzeSupplierPatterns as ReturnType<typeof vi.fn>;

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const SUPPLIER_ID = "22222222-2222-2222-2222-222222222222";
const DOC_ID = "33333333-3333-3333-3333-333333333333";

const baseDoc = {
  id: DOC_ID,
  supplierNameNormalized: "Swisscom AG",
  supplierId: SUPPLIER_ID,
  grossAmount: 150,
  currency: "CHF",
  documentType: "invoice",
  invoiceDate: new Date("2026-04-01"),
  confidenceScore: 0.95,
  decisionReasons: { escalations: [], validationErrors: [] },
};

const baseConfig = {
  minHistoryMatches: 5,
  minStabilityScore: 0.8,
  maxAmount: null as number | null,
  minConfidence: 0.85,
  allowedDocTypes: null as string[] | null,
  allowedCurrencies: null as string[] | null,
  supplierAllowlist: null as string[] | null,
};

function setHappyPath() {
  mockSupplierFindFirst.mockResolvedValue({ isVerified: true });
  mockDocumentCount.mockResolvedValue(10);
  mockCheckPeriodLock.mockResolvedValue({ locked: false });
  mockAnalyzePatterns.mockResolvedValue({ accountStability: 0.95 } as any);
}

describe("runSafetyChecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHappyPath();
  });

  it("Alle Checks bestanden → eligible true, blockedBy null", async () => {
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, baseConfig);
    expect(result.eligible).toBe(true);
    expect(result.blockedBy).toBe(null);
    expect(Object.values(result.checks).every((c) => c.passed)).toBe(true);
  });

  it("Supplier nicht verifiziert → blocked by supplierVerified", async () => {
    mockSupplierFindFirst.mockResolvedValue({ isVerified: false });
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("supplierVerified");
    expect(result.checks.supplierVerified.passed).toBe(false);
  });

  it("Eskalation aktiv → blocked by noEscalations", async () => {
    const doc = {
      ...baseDoc,
      decisionReasons: { escalations: [{ rule: "amount" }], validationErrors: [] },
    };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("noEscalations");
  });

  it("Validierungsfehler → blocked by noValidationErrors", async () => {
    const doc = {
      ...baseDoc,
      decisionReasons: { escalations: [], validationErrors: [{ field: "vat" }] },
    };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("noValidationErrors");
  });

  it("Confidence unter Schwelle → blocked by confidenceAboveMin", async () => {
    const doc = { ...baseDoc, confidenceScore: 0.7 };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("confidenceAboveMin");
  });

  it("Periode gesperrt → blocked by periodNotLocked", async () => {
    mockCheckPeriodLock.mockResolvedValue({ locked: true, message: "gesperrt" });
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("periodNotLocked");
  });

  it("Zu wenig Historie → blocked by enoughHistory", async () => {
    mockDocumentCount.mockResolvedValue(2);
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("enoughHistory");
  });

  it("Konto-Stabilität zu niedrig → blocked by stableAccount", async () => {
    mockAnalyzePatterns.mockResolvedValue({ accountStability: 0.5 } as any);
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, baseConfig);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("stableAccount");
  });

  it("Betrag über Maximum → blocked by amountBelowMax", async () => {
    const doc = { ...baseDoc, grossAmount: 5000 };
    const config = { ...baseConfig, maxAmount: 1000 };
    const result = await runSafetyChecks(COMPANY_ID, doc, config);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("amountBelowMax");
  });

  it("Belegtyp nicht erlaubt → blocked by allowedDocType", async () => {
    const doc = { ...baseDoc, documentType: "receipt" };
    const config = { ...baseConfig, allowedDocTypes: ["invoice"] };
    const result = await runSafetyChecks(COMPANY_ID, doc, config);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("allowedDocType");
  });

  it("Währung nicht erlaubt → blocked by allowedCurrency", async () => {
    const doc = { ...baseDoc, currency: "USD" };
    const config = { ...baseConfig, allowedCurrencies: ["CHF", "EUR"] };
    const result = await runSafetyChecks(COMPANY_ID, doc, config);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("allowedCurrency");
  });

  it("Supplier nicht auf Allowlist → blocked by supplierOnAllowlist", async () => {
    const config = {
      ...baseConfig,
      supplierAllowlist: ["99999999-9999-9999-9999-999999999999"],
    };
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, config);
    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toBe("supplierOnAllowlist");
  });

  it("Kein maxAmount konfiguriert → Check wird übersprungen", async () => {
    const doc = { ...baseDoc, grossAmount: 999999 };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.checks.amountBelowMax).toBeUndefined();
    expect(result.eligible).toBe(true);
  });

  it("Keine Allowlist → Check wird übersprungen", async () => {
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, baseConfig);
    expect(result.checks.supplierOnAllowlist).toBeUndefined();
    expect(result.checks.allowedDocType).toBeUndefined();
    expect(result.checks.allowedCurrency).toBeUndefined();
    expect(result.eligible).toBe(true);
  });

  it("Erster fehlgeschlagener Check bestimmt blockedBy (supplierVerified vor noEscalations)", async () => {
    mockSupplierFindFirst.mockResolvedValue({ isVerified: false });
    const doc = {
      ...baseDoc,
      decisionReasons: { escalations: [{ rule: "x" }], validationErrors: [] },
    };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.blockedBy).toBe("supplierVerified");
    expect(result.checks.noEscalations.passed).toBe(false);
  });

  it("Allowlist mit Supplier-ID drauf → eligible", async () => {
    const config = { ...baseConfig, supplierAllowlist: [SUPPLIER_ID] };
    const result = await runSafetyChecks(COMPANY_ID, baseDoc, config);
    expect(result.eligible).toBe(true);
    expect(result.checks.supplierOnAllowlist.passed).toBe(true);
  });

  it("Kein Supplier-ID → supplierVerified failed", async () => {
    const doc = { ...baseDoc, supplierId: null };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.checks.supplierVerified.passed).toBe(false);
    expect(mockSupplierFindFirst).not.toHaveBeenCalled();
  });

  it("Kein invoiceDate → checkPeriodLock wird nicht aufgerufen, periode gilt als offen", async () => {
    const doc = { ...baseDoc, invoiceDate: null };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(mockCheckPeriodLock).not.toHaveBeenCalled();
    expect(result.checks.periodNotLocked.passed).toBe(true);
  });

  it("Confidence null → wird als 0 behandelt und blockiert", async () => {
    const doc = { ...baseDoc, confidenceScore: null };
    const result = await runSafetyChecks(COMPANY_ID, doc, baseConfig);
    expect(result.checks.confidenceAboveMin.passed).toBe(false);
  });
});
