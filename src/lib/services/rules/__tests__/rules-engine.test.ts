import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    rule: { findMany: vi.fn() },
  },
}));

import { applyRules } from "../rules-engine";
import { prisma } from "@/lib/db";

const mockRules = prisma.rule.findMany as ReturnType<typeof vi.fn>;

function makeRule(overrides: any = {}) {
  return {
    id: "rule-1",
    companyId: "comp-1",
    name: "Test Rule",
    ruleType: "supplier_default",
    conditions: [{ field: "supplierName", operator: "contains", value: "GoMore" }],
    actions: [{ type: "set_category", value: "Vehicle Rental" }],
    priority: 10,
    isActive: true,
    ...overrides,
  };
}

const testDoc = {
  supplierNameNormalized: "GoMore",
  supplierNameRaw: "GoMore AG",
  invoiceNumber: "INV-1",
  grossAmount: 100,
  currency: "CHF",
  expenseCategory: null,
  documentType: "invoice",
};

describe("applyRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keine Regeln → leere matches", async () => {
    mockRules.mockResolvedValue([]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(0);
    expect(result.updates).toEqual({});
    expect(result.shouldAutoApprove).toBe(false);
  });

  it("matcht Regel mit contains", async () => {
    mockRules.mockResolvedValue([makeRule()]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(1);
    expect(result.updates.expenseCategory).toBe("Vehicle Rental");
  });

  it("equals case-insensitive", async () => {
    mockRules.mockResolvedValue([
      makeRule({ conditions: [{ field: "supplierName", operator: "equals", value: "gomore" }] }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(1);
  });

  it("greater_than matcht", async () => {
    mockRules.mockResolvedValue([
      makeRule({ conditions: [{ field: "grossAmount", operator: "greater_than", value: "50" }] }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(1);
  });

  it("less_than matcht nicht wenn Betrag höher", async () => {
    mockRules.mockResolvedValue([
      makeRule({ conditions: [{ field: "grossAmount", operator: "less_than", value: "50" }] }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(0);
  });

  it("starts_with matcht", async () => {
    mockRules.mockResolvedValue([
      makeRule({ conditions: [{ field: "supplierName", operator: "starts_with", value: "GoM" }] }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(1);
  });

  it("AND-Logik: alle Conditions müssen matchen", async () => {
    mockRules.mockResolvedValue([
      makeRule({
        conditions: [
          { field: "supplierName", operator: "contains", value: "GoMore" },
          { field: "grossAmount", operator: "less_than", value: "50" }, // doesn't match
        ],
      }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(0);
  });

  it("auto_approve Action setzt shouldAutoApprove", async () => {
    mockRules.mockResolvedValue([
      makeRule({ actions: [{ type: "auto_approve" }] }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.shouldAutoApprove).toBe(true);
  });

  it("höhere Priority gewinnt pro Feld", async () => {
    mockRules.mockResolvedValue([
      makeRule({ id: "r1", priority: 20, actions: [{ type: "set_category", value: "HIGH" }] }),
      makeRule({ id: "r2", priority: 10, actions: [{ type: "set_category", value: "LOW" }] }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.updates.expenseCategory).toBe("HIGH");
  });

  it("überspringt Regel mit ungültigem conditions-Format", async () => {
    mockRules.mockResolvedValue([
      makeRule({ conditions: "invalid" }),
    ]);
    const result = await applyRules("comp-1", "doc-1", testDoc);
    expect(result.matches).toHaveLength(0);
  });
});
