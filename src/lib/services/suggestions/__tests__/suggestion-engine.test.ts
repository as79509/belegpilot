import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    document: { findMany: vi.fn() },
    rule: { findMany: vi.fn() },
    knowledgeItem: { findMany: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}));

import { generateSuggestion } from "../suggestion-engine";
import { prisma } from "@/lib/db";

const mockDocFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>;
const mockRuleFindMany = prisma.rule.findMany as ReturnType<typeof vi.fn>;
const mockKnowledgeFindMany = prisma.knowledgeItem.findMany as ReturnType<typeof vi.fn>;
const mockSupplierFindFirst = prisma.supplier.findFirst as ReturnType<typeof vi.fn>;

const baseDoc = {
  supplierNameNormalized: "Swisscom AG",
  grossAmount: 150,
  currency: "CHF",
  vatRatesDetected: [{ rate: 8.1 }],
  expenseCategory: "Telekommunikation",
  documentType: "invoice",
};

function makeHistoricalDoc(overrides: any = {}) {
  return {
    accountCode: "6500",
    expenseCategory: "Telekommunikation",
    grossAmount: 120,
    vatRatesDetected: [{ rate: 8.1 }],
    costCenter: "IT",
    ...overrides,
  };
}

describe("generateSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuleFindMany.mockResolvedValue([]);
    mockKnowledgeFindMany.mockResolvedValue([]);
    mockSupplierFindFirst.mockResolvedValue(null);
  });

  it("0 historische Belege → null (kein Vorschlag)", async () => {
    mockDocFindMany.mockResolvedValue([]);
    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result).toBeNull();
  });

  it("5 Belege alle gleiches Konto → confidence high (≥0.85)", async () => {
    const docs = Array.from({ length: 5 }, () => makeHistoricalDoc());
    mockDocFindMany.mockResolvedValue(docs);

    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("high");
    expect(result!.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(result!.suggestedAccount).toBe("6500");
    expect(result!.suggestedCategory).toBe("Telekommunikation");
    expect(result!.matchedDocCount).toBe(5);
    expect(result!.consistencyRate).toBe(1.0);
  });

  it("3 Belege, 2 gleiches Konto → confidence medium", async () => {
    const docs = [
      makeHistoricalDoc({ accountCode: "6500" }),
      makeHistoricalDoc({ accountCode: "6500" }),
      makeHistoricalDoc({ accountCode: "6510" }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("medium");
    expect(result!.confidenceScore).toBeGreaterThanOrEqual(0.65);
    expect(result!.confidenceScore).toBeLessThan(0.85);
    expect(result!.suggestedAccount).toBe("6500");
    expect(result!.consistencyRate).toBeCloseTo(2 / 3);
  });

  it("1 Beleg → confidence low", async () => {
    mockDocFindMany.mockResolvedValue([makeHistoricalDoc()]);

    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("low");
    expect(result!.confidenceScore).toBeLessThan(0.65);
    expect(result!.matchedDocCount).toBe(1);
  });

  it("Regel-Match → Bonus +0.05", async () => {
    const docs = Array.from({ length: 5 }, () => makeHistoricalDoc());
    mockDocFindMany.mockResolvedValue(docs);

    // Ohne Regel
    const resultWithout = await generateSuggestion("comp-1", baseDoc);
    const scoreWithout = resultWithout!.confidenceScore;

    // Mit Regel
    mockRuleFindMany.mockResolvedValue([{
      id: "rule-1",
      companyId: "comp-1",
      name: "Telekom-Regel",
      conditions: [{ field: "expenseCategory", operator: "equals", value: "Telekommunikation" }],
      actions: [{ type: "set_account_code", value: "6500" }],
      isActive: true,
    }]);
    const resultWith = await generateSuggestion("comp-1", baseDoc);
    expect(resultWith!.confidenceScore).toBeCloseTo(scoreWithout + 0.05, 2);
  });

  it("Knowledge-Match → Bonus +0.03", async () => {
    const docs = Array.from({ length: 5 }, () => makeHistoricalDoc());
    mockDocFindMany.mockResolvedValue(docs);

    // Ohne Knowledge
    const resultWithout = await generateSuggestion("comp-1", baseDoc);
    const scoreWithout = resultWithout!.confidenceScore;

    // Mit Knowledge
    mockKnowledgeFindMany.mockResolvedValue([{
      id: "ki-1",
      title: "Swisscom buchen",
      content: "Immer auf 6500",
    }]);
    const resultWith = await generateSuggestion("comp-1", baseDoc);
    expect(resultWith!.confidenceScore).toBeCloseTo(scoreWithout + 0.03, 2);
  });

  it("Supplier-Default → Bonus +0.05", async () => {
    const docs = Array.from({ length: 5 }, () => makeHistoricalDoc());
    mockDocFindMany.mockResolvedValue(docs);

    // Ohne Supplier-Default
    const resultWithout = await generateSuggestion("comp-1", baseDoc);
    const scoreWithout = resultWithout!.confidenceScore;

    // Mit Supplier-Default
    mockSupplierFindFirst.mockResolvedValue({
      defaultAccountCode: "6500",
      defaultCategory: "Telekommunikation",
      isVerified: true,
    });
    const resultWith = await generateSuggestion("comp-1", baseDoc);
    expect(resultWith!.confidenceScore).toBeCloseTo(scoreWithout + 0.05, 2);
  });

  it("Reasoning enthält immer Quellen-Array mit type + detail", async () => {
    const docs = Array.from({ length: 3 }, () => makeHistoricalDoc());
    mockDocFindMany.mockResolvedValue(docs);

    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result).not.toBeNull();
    expect(result!.reasoning.sources).toBeInstanceOf(Array);
    expect(result!.reasoning.sources.length).toBeGreaterThan(0);
    for (const source of result!.reasoning.sources) {
      expect(source).toHaveProperty("type");
      expect(source).toHaveProperty("detail");
      expect(["history", "rule", "knowledge", "supplier_default"]).toContain(source.type);
      expect(typeof source.detail).toBe("string");
    }
    expect(typeof result!.reasoning.explanation).toBe("string");
    expect(result!.reasoning.explanation.length).toBeGreaterThan(0);
  });

  it("kein Lieferantenname → null", async () => {
    const result = await generateSuggestion("comp-1", {
      ...baseDoc,
      supplierNameNormalized: null,
    });
    expect(result).toBeNull();
  });

  it("MwSt-Code wird aus einzelnem Satz abgeleitet", async () => {
    mockDocFindMany.mockResolvedValue([makeHistoricalDoc()]);
    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result).not.toBeNull();
    expect(result!.suggestedVatCode).toBe("8.1");
  });

  it("CostCenter wird aus Historie vorgeschlagen", async () => {
    const docs = Array.from({ length: 3 }, () => makeHistoricalDoc({ costCenter: "Marketing" }));
    mockDocFindMany.mockResolvedValue(docs);

    const result = await generateSuggestion("comp-1", baseDoc);
    expect(result!.suggestedCostCenter).toBe("Marketing");
  });
});
