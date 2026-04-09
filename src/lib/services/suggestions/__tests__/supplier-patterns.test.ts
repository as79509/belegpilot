import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    document: { findMany: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}));

import { analyzeSupplierPatterns } from "../supplier-patterns";
import { prisma } from "@/lib/db";

const mockDocFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>;
const mockSupplierFindFirst = prisma.supplier.findFirst as ReturnType<typeof vi.fn>;

function makeDoc(overrides: any = {}) {
  return {
    accountCode: "6500",
    grossAmount: 100,
    vatRatesDetected: [{ rate: 8.1 }],
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("analyzeSupplierPatterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupplierFindFirst.mockResolvedValue({ id: "sup-1", isVerified: true });
  });

  it("0 Belege → null", async () => {
    mockDocFindMany.mockResolvedValue([]);
    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result).toBeNull();
  });

  it("5 Belege alle gleiches Konto → accountStability 1.0", async () => {
    const docs = Array.from({ length: 5 }, () => makeDoc({ grossAmount: 100 }));
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result).not.toBeNull();
    expect(result!.dominantAccount).toBe("6500");
    expect(result!.accountStability).toBe(1.0);
    expect(result!.totalApprovedDocs).toBe(5);
    expect(result!.isAmountStable).toBe(true); // alle 100 → StdDev 0
  });

  it("3 verschiedene Konten → niedrige Stabilität", async () => {
    const docs = [
      makeDoc({ accountCode: "6500" }),
      makeDoc({ accountCode: "6500" }),
      makeDoc({ accountCode: "6510" }),
      makeDoc({ accountCode: "6520" }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.dominantAccount).toBe("6500");
    expect(result!.accountStability).toBe(0.5); // 2/4
  });

  it("Betrags-Median korrekt berechnet (nicht Durchschnitt)", async () => {
    // Median von [10, 20, 30, 40, 1000] = 30 (nicht 220 wie der Durchschnitt)
    const docs = [
      makeDoc({ grossAmount: 10 }),
      makeDoc({ grossAmount: 20 }),
      makeDoc({ grossAmount: 30 }),
      makeDoc({ grossAmount: 40 }),
      makeDoc({ grossAmount: 1000 }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.typicalAmount).toBe(30);
  });

  it("StdDev < 20% → isAmountStable true", async () => {
    // Beträge nahe 100, max 5% Abweichung
    const docs = [
      makeDoc({ grossAmount: 100 }),
      makeDoc({ grossAmount: 102 }),
      makeDoc({ grossAmount: 98 }),
      makeDoc({ grossAmount: 101 }),
      makeDoc({ grossAmount: 99 }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.isAmountStable).toBe(true);
  });

  it("StdDev > 20% → isAmountStable false", async () => {
    // Stark schwankende Beträge
    const docs = [
      makeDoc({ grossAmount: 100 }),
      makeDoc({ grossAmount: 500 }),
      makeDoc({ grossAmount: 50 }),
      makeDoc({ grossAmount: 1000 }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.isAmountStable).toBe(false);
  });

  it("Weniger als 3 Belege → isAmountStable false", async () => {
    const docs = [
      makeDoc({ grossAmount: 100 }),
      makeDoc({ grossAmount: 100 }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.isAmountStable).toBe(false);
  });

  it("MwSt alle gleich → vatStability 1.0", async () => {
    const docs = Array.from({ length: 5 }, () => makeDoc({ vatRatesDetected: [{ rate: 8.1 }] }));
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.dominantVatRate).toBe(8.1);
    expect(result!.vatStability).toBe(1.0);
  });

  it("MwSt gemischt → vatStability < 1.0", async () => {
    const docs = [
      makeDoc({ vatRatesDetected: [{ rate: 8.1 }] }),
      makeDoc({ vatRatesDetected: [{ rate: 8.1 }] }),
      makeDoc({ vatRatesDetected: [{ rate: 8.1 }] }),
      makeDoc({ vatRatesDetected: [{ rate: 2.6 }] }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.dominantVatRate).toBe(8.1);
    expect(result!.vatStability).toBe(0.75); // 3/4
  });

  it("isVerified wird vom Supplier geladen", async () => {
    const docs = Array.from({ length: 3 }, () => makeDoc());
    mockDocFindMany.mockResolvedValue(docs);
    mockSupplierFindFirst.mockResolvedValue({ id: "sup-1", isVerified: false });

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.isVerified).toBe(false);
  });

  it("accountHistory ist sortiert nach Häufigkeit", async () => {
    const docs = [
      makeDoc({ accountCode: "6510" }),
      makeDoc({ accountCode: "6500" }),
      makeDoc({ accountCode: "6500" }),
      makeDoc({ accountCode: "6500" }),
      makeDoc({ accountCode: "6510" }),
    ];
    mockDocFindMany.mockResolvedValue(docs);

    const result = await analyzeSupplierPatterns("comp-1", "Swisscom");
    expect(result!.accountHistory[0]).toEqual({ code: "6500", count: 3 });
    expect(result!.accountHistory[1]).toEqual({ code: "6510", count: 2 });
  });
});
