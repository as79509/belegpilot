import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    document: { findFirst: vi.fn(), count: vi.fn() },
    supplier: { findFirst: vi.fn(), count: vi.fn() },
    correctionPattern: { findMany: vi.fn(), count: vi.fn() },
    task: { count: vi.fn() },
    monthlyPeriod: { findFirst: vi.fn() },
    recurringEntry: { count: vi.fn() },
    journalEntry: { count: vi.fn() },
    asset: { count: vi.fn() },
    exportRecord: { count: vi.fn() },
  },
}));

import {
  getDocumentActions,
  getCompanyActions,
  getPeriodActions,
} from "../next-action";
import { prisma } from "@/lib/db";

const mockDocFindFirst = prisma.document.findFirst as ReturnType<typeof vi.fn>;
const mockDocCount = prisma.document.count as ReturnType<typeof vi.fn>;
const mockSupplierFindFirst = prisma.supplier.findFirst as ReturnType<typeof vi.fn>;
const mockSupplierCount = prisma.supplier.count as ReturnType<typeof vi.fn>;
const mockPatternFindMany = prisma.correctionPattern.findMany as ReturnType<typeof vi.fn>;
const mockPatternCount = prisma.correctionPattern.count as ReturnType<typeof vi.fn>;
const mockTaskCount = prisma.task.count as ReturnType<typeof vi.fn>;
const mockPeriodFindFirst = prisma.monthlyPeriod.findFirst as ReturnType<typeof vi.fn>;
const mockRecurringCount = prisma.recurringEntry.count as ReturnType<typeof vi.fn>;
const mockJournalCount = prisma.journalEntry.count as ReturnType<typeof vi.fn>;
const mockAssetCount = prisma.asset.count as ReturnType<typeof vi.fn>;
const mockExportCount = prisma.exportRecord.count as ReturnType<typeof vi.fn>;

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const DOC_ID = "22222222-2222-2222-2222-222222222222";
const SUPPLIER_ID = "33333333-3333-3333-3333-333333333333";
const PERIOD_ID = "44444444-4444-4444-4444-444444444444";

function resetAllDocMocks() {
  mockDocFindFirst.mockReset();
  mockDocCount.mockReset();
  mockSupplierFindFirst.mockReset();
  mockSupplierCount.mockReset();
  mockPatternFindMany.mockReset();
  mockPatternCount.mockReset();
  mockTaskCount.mockReset();
  mockPeriodFindFirst.mockReset();
  mockRecurringCount.mockReset();
  mockJournalCount.mockReset();
  mockAssetCount.mockReset();
  mockExportCount.mockReset();
}

describe("getDocumentActions", () => {
  beforeEach(() => {
    resetAllDocMocks();
    // Defaults: nichts gibt Aktionen
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: null,
      status: "ready",
      bookingSuggestions: [],
    });
    mockSupplierFindFirst.mockResolvedValue(null);
    mockPatternFindMany.mockResolvedValue([]);
    mockTaskCount.mockResolvedValue(0);
  });

  it("Beleg nicht gefunden → leeres Array", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result).toEqual([]);
  });

  it("Keine Probleme → leeres Array", async () => {
    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result).toEqual([]);
  });

  it("Supplier nicht verifiziert → enthält 'verify_supplier'", async () => {
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      status: "ready",
      bookingSuggestions: [],
    });
    mockSupplierFindFirst.mockResolvedValue({
      isVerified: false,
      nameNormalized: "Migros",
    });

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "verify_supplier")).toBe(true);
    const action = result.find((a) => a.type === "verify_supplier")!;
    expect(action.priority).toBe("high");
    expect(action.title).toContain("Migros");
    expect(action.targetType).toBe("supplier");
    expect(action.targetId).toBe(SUPPLIER_ID);
  });

  it("Supplier verifiziert → enthält NICHT 'verify_supplier'", async () => {
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      status: "ready",
      bookingSuggestions: [],
    });
    mockSupplierFindFirst.mockResolvedValue({
      isVerified: true,
      nameNormalized: "Migros",
    });

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "verify_supplier")).toBe(false);
  });

  it("Offene Korrekturmuster → enthält 'create_rule'", async () => {
    mockPatternFindMany.mockResolvedValue([
      {
        id: "p1",
        field: "accountCode",
        fromValue: "6800",
        toValue: "6300",
        occurrences: 5,
      },
    ]);

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "create_rule")).toBe(true);
    const action = result.find((a) => a.type === "create_rule")!;
    expect(action.priority).toBe("medium");
    expect(action.title).toContain("accountCode");
    expect(action.title).toContain("5×");
  });

  it("Pending Suggestion → enthält 'review_suggestion'", async () => {
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: null,
      status: "ready",
      bookingSuggestions: [
        {
          status: "pending",
          confidenceLevel: "high",
          suggestedAccount: "6800",
        },
      ],
    });

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "review_suggestion")).toBe(true);
    const action = result.find((a) => a.type === "review_suggestion")!;
    expect(action.priority).toBe("medium");
    expect(action.detail).toContain("6800");
  });

  it("Suggestion akzeptiert → KEIN 'review_suggestion'", async () => {
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: null,
      status: "ready",
      bookingSuggestions: [
        { status: "accepted", confidenceLevel: "high", suggestedAccount: "6800" },
      ],
    });

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "review_suggestion")).toBe(false);
  });

  it("Offene Tasks → enthält 'resolve_task'", async () => {
    mockTaskCount.mockResolvedValue(3);

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "resolve_task")).toBe(true);
    const action = result.find((a) => a.type === "resolve_task")!;
    expect(action.priority).toBe("high");
    expect(action.title).toContain("3");
  });

  it("Status needs_review → enthält 'review_document'", async () => {
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: null,
      status: "needs_review",
      bookingSuggestions: [],
    });

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);
    expect(result.some((a) => a.type === "review_document")).toBe(true);
    const action = result.find((a) => a.type === "review_document")!;
    expect(action.priority).toBe("high");
  });

  it("Sortierung: high vor medium vor low", async () => {
    mockDocFindFirst.mockResolvedValue({
      id: DOC_ID,
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      status: "needs_review",
      bookingSuggestions: [
        { status: "pending", confidenceLevel: "high", suggestedAccount: "6800" },
      ],
    });
    mockSupplierFindFirst.mockResolvedValue({
      isVerified: false,
      nameNormalized: "Migros",
    });
    mockPatternFindMany.mockResolvedValue([
      {
        id: "p1",
        field: "accountCode",
        fromValue: "6800",
        toValue: "6300",
        occurrences: 5,
      },
    ]);
    mockTaskCount.mockResolvedValue(2);

    const result = await getDocumentActions(COMPANY_ID, DOC_ID);

    // Alle high müssen vor allen medium kommen
    let seenMedium = false;
    for (const a of result) {
      if (a.priority === "medium") seenMedium = true;
      if (a.priority === "high" && seenMedium) {
        throw new Error("high priority erscheint nach medium — Sortierung falsch");
      }
    }

    expect(result.length).toBeGreaterThanOrEqual(4);
  });
});

describe("getCompanyActions", () => {
  beforeEach(() => {
    resetAllDocMocks();
    mockDocCount.mockResolvedValue(0);
    mockSupplierCount.mockResolvedValue(0);
    mockPatternCount.mockResolvedValue(0);
    mockExportCount.mockResolvedValue(0);
    mockTaskCount.mockResolvedValue(0);
  });

  it("Keine Probleme → leeres Array", async () => {
    const result = await getCompanyActions(COMPANY_ID);
    expect(result).toEqual([]);
  });

  it("Belege im Review → enthält 'review_backlog'", async () => {
    mockDocCount.mockResolvedValue(7);

    const result = await getCompanyActions(COMPANY_ID);
    expect(result.some((a) => a.type === "review_backlog")).toBe(true);
    const action = result.find((a) => a.type === "review_backlog")!;
    expect(action.priority).toBe("high");
    expect(action.title).toContain("7");
  });

  it("Unverifizierte Lieferanten → enthält 'verify_suppliers'", async () => {
    mockSupplierCount.mockResolvedValue(4);

    const result = await getCompanyActions(COMPANY_ID);
    expect(result.some((a) => a.type === "verify_suppliers")).toBe(true);
    const action = result.find((a) => a.type === "verify_suppliers")!;
    expect(action.priority).toBe("medium");
    expect(action.title).toContain("4");
  });

  it("Offene Patterns → enthält 'promote_patterns'", async () => {
    mockPatternCount.mockResolvedValue(2);

    const result = await getCompanyActions(COMPANY_ID);
    expect(result.some((a) => a.type === "promote_patterns")).toBe(true);
    const action = result.find((a) => a.type === "promote_patterns")!;
    expect(action.priority).toBe("medium");
  });

  it("Failed Exports → enthält 'fix_exports' mit high priority", async () => {
    mockExportCount.mockResolvedValue(1);

    const result = await getCompanyActions(COMPANY_ID);
    expect(result.some((a) => a.type === "fix_exports")).toBe(true);
    const action = result.find((a) => a.type === "fix_exports")!;
    expect(action.priority).toBe("high");
  });

  it("Sortierung: high vor medium", async () => {
    mockDocCount.mockResolvedValue(5);
    mockSupplierCount.mockResolvedValue(3);
    mockPatternCount.mockResolvedValue(2);

    const result = await getCompanyActions(COMPANY_ID);
    let seenMedium = false;
    for (const a of result) {
      if (a.priority === "medium") seenMedium = true;
      if (a.priority === "high" && seenMedium) {
        throw new Error("high priority erscheint nach medium");
      }
    }
  });
});

describe("getPeriodActions", () => {
  beforeEach(() => {
    resetAllDocMocks();
    mockPeriodFindFirst.mockResolvedValue({
      id: PERIOD_ID,
      companyId: COMPANY_ID,
      year: 2026,
      month: 3,
      status: "open",
    });
    mockDocCount.mockResolvedValue(0);
    mockTaskCount.mockResolvedValue(0);
    mockRecurringCount.mockResolvedValue(0);
    mockJournalCount.mockResolvedValue(0);
    mockAssetCount.mockResolvedValue(0);
  });

  it("Periode nicht gefunden → leeres Array", async () => {
    mockPeriodFindFirst.mockResolvedValue(null);
    const result = await getPeriodActions(COMPANY_ID, PERIOD_ID);
    expect(result).toEqual([]);
  });

  it("Offene Belege in Periode → enthält 'review_period_docs'", async () => {
    mockDocCount.mockResolvedValue(3);
    const result = await getPeriodActions(COMPANY_ID, PERIOD_ID);
    expect(result.some((a) => a.type === "review_period_docs")).toBe(true);
  });

  it("Periode abschliessbar → enthält 'close_period'", async () => {
    // Default: Periode open, keine Probleme
    const result = await getPeriodActions(COMPANY_ID, PERIOD_ID);
    expect(result.some((a) => a.type === "close_period")).toBe(true);
  });
});
