import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    correctionEvent: { create: vi.fn() },
    correctionPattern: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { trackCorrections, getActionablePatterns, PATTERN_THRESHOLD } from "../correction-tracker";
import { prisma } from "@/lib/db";

const mockEventCreate = prisma.correctionEvent.create as ReturnType<typeof vi.fn>;
const mockPatternFindUnique = prisma.correctionPattern.findUnique as ReturnType<typeof vi.fn>;
const mockPatternCreate = prisma.correctionPattern.create as ReturnType<typeof vi.fn>;
const mockPatternUpdate = prisma.correctionPattern.update as ReturnType<typeof vi.fn>;
const mockPatternFindMany = prisma.correctionPattern.findMany as ReturnType<typeof vi.fn>;

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const DOC_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-4444-444444444444";

describe("trackCorrections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventCreate.mockResolvedValue({});
    mockPatternFindUnique.mockResolvedValue(null);
    mockPatternCreate.mockResolvedValue({});
    mockPatternUpdate.mockResolvedValue({});
  });

  it("Gleiche Werte → kein CorrectionEvent (0 corrections)", async () => {
    const fields = {
      accountCode: "6800",
      expenseCategory: "Marketing",
      costCenter: "M1",
    };

    const count = await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      fields,
      fields,
      SUPPLIER_ID
    );

    expect(count).toBe(0);
    expect(mockEventCreate).not.toHaveBeenCalled();
    expect(mockPatternCreate).not.toHaveBeenCalled();
    expect(mockPatternUpdate).not.toHaveBeenCalled();
  });

  it("accountCode geändert → 1 CorrectionEvent + 1 CorrectionPattern erstellt", async () => {
    const count = await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: "6800", expenseCategory: "Marketing", costCenter: null },
      { accountCode: "6300", expenseCategory: "Marketing", costCenter: null },
      SUPPLIER_ID
    );

    expect(count).toBe(1);
    expect(mockEventCreate).toHaveBeenCalledTimes(1);
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: COMPANY_ID,
        documentId: DOC_ID,
        supplierId: SUPPLIER_ID,
        field: "accountCode",
        originalValue: "6800",
        correctedValue: "6300",
        correctedBy: USER_ID,
        source: "review",
      }),
    });
    expect(mockPatternCreate).toHaveBeenCalledTimes(1);
    expect(mockPatternCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: COMPANY_ID,
        supplierId: SUPPLIER_ID,
        field: "accountCode",
        fromValue: "6800",
        toValue: "6300",
        occurrences: 1,
      }),
    });
    expect(mockPatternUpdate).not.toHaveBeenCalled();
  });

  it("Zwei Felder geändert → 2 Events", async () => {
    const count = await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: "6800", expenseCategory: "Marketing", costCenter: null },
      { accountCode: "6300", expenseCategory: "Werbung", costCenter: null },
      SUPPLIER_ID
    );

    expect(count).toBe(2);
    expect(mockEventCreate).toHaveBeenCalledTimes(2);
    expect(mockPatternCreate).toHaveBeenCalledTimes(2);
  });

  it("Bestehendes Pattern → occurrences incrementiert (nicht neu erstellt)", async () => {
    mockPatternFindUnique.mockResolvedValue({
      id: "pattern-1",
      occurrences: 4,
    });

    const count = await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: "6800", expenseCategory: null, costCenter: null },
      { accountCode: "6300", expenseCategory: null, costCenter: null },
      SUPPLIER_ID
    );

    expect(count).toBe(1);
    expect(mockEventCreate).toHaveBeenCalledTimes(1);
    expect(mockPatternUpdate).toHaveBeenCalledTimes(1);
    expect(mockPatternUpdate).toHaveBeenCalledWith({
      where: { id: "pattern-1" },
      data: expect.objectContaining({
        occurrences: 5,
        lastSeenAt: expect.any(Date),
      }),
    });
    expect(mockPatternCreate).not.toHaveBeenCalled();
  });

  it("Kein supplierId → leerer String als Sentinel im Pattern-Lookup", async () => {
    await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: "6800", expenseCategory: null, costCenter: null },
      { accountCode: "6300", expenseCategory: null, costCenter: null },
      null
    );

    expect(mockPatternFindUnique).toHaveBeenCalledWith({
      where: {
        companyId_supplierId_field_fromValue_toValue: {
          companyId: COMPANY_ID,
          supplierId: "",
          field: "accountCode",
          fromValue: "6800",
          toValue: "6300",
        },
      },
    });
    expect(mockPatternCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ supplierId: "" }),
    });
  });

  it("Originalwert null → fromValue als leerer String gespeichert", async () => {
    await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: null, expenseCategory: null, costCenter: null },
      { accountCode: "6300", expenseCategory: null, costCenter: null },
      SUPPLIER_ID
    );

    expect(mockPatternCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromValue: "",
        toValue: "6300",
      }),
    });
  });

  it("Finaler Wert null/leer → wird übersprungen, keine Korrektur", async () => {
    const count = await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: "6800", expenseCategory: "Marketing", costCenter: "M1" },
      { accountCode: null, expenseCategory: null, costCenter: null },
      SUPPLIER_ID
    );

    expect(count).toBe(0);
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it("Source-Parameter wird übernommen", async () => {
    await trackCorrections(
      COMPANY_ID,
      DOC_ID,
      USER_ID,
      { accountCode: "6800", expenseCategory: null, costCenter: null },
      { accountCode: "6300", expenseCategory: null, costCenter: null },
      SUPPLIER_ID,
      "suggestion_modified"
    );

    expect(mockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: "suggestion_modified" }),
    });
  });
});

describe("getActionablePatterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Filter: nur Patterns mit occurrences >= 3 und status open", async () => {
    mockPatternFindMany.mockResolvedValue([]);

    await getActionablePatterns(COMPANY_ID);

    expect(mockPatternFindMany).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY_ID,
        status: "open",
        occurrences: { gte: PATTERN_THRESHOLD },
      },
      orderBy: { occurrences: "desc" },
      take: 20,
    });
    expect(PATTERN_THRESHOLD).toBe(3);
  });

  it("Pattern mit occurrences 2 → nicht in actionable (Filter greift)", async () => {
    // Simuliere DB-Verhalten: nur Records mit occurrences >= 3 zurückgeben
    mockPatternFindMany.mockImplementation(async ({ where }: any) => {
      const all = [
        { id: "p1", occurrences: 5, status: "open" },
        { id: "p2", occurrences: 2, status: "open" },
        { id: "p3", occurrences: 4, status: "open" },
      ];
      return all.filter(
        (p) =>
          p.status === where.status &&
          p.occurrences >= where.occurrences.gte
      );
    });

    const result = await getActionablePatterns(COMPANY_ID);
    expect(result).toHaveLength(2);
    expect(result.map((p: any) => p.id)).toEqual(["p1", "p3"]);
    expect(result.find((p: any) => p.id === "p2")).toBeUndefined();
  });

  it("Pattern mit status promoted → nicht in actionable (Filter greift)", async () => {
    mockPatternFindMany.mockImplementation(async ({ where }: any) => {
      const all = [
        { id: "p1", occurrences: 5, status: "open" },
        { id: "p2", occurrences: 5, status: "promoted" },
        { id: "p3", occurrences: 5, status: "dismissed" },
      ];
      return all.filter(
        (p) =>
          p.status === where.status &&
          p.occurrences >= where.occurrences.gte
      );
    });

    const result = await getActionablePatterns(COMPANY_ID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });
});
