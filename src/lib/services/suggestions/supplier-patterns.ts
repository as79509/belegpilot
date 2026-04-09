import { prisma } from "@/lib/db";

export interface SupplierPattern {
  supplierId: string | null;
  supplierName: string;
  // Konto-Stabilität
  dominantAccount: string | null;
  accountStability: number; // 0.0–1.0
  accountHistory: Array<{ code: string; count: number }>;
  // Betrags-Muster
  typicalAmount: number | null;      // Median der letzten 20 Belege
  amountStdDeviation: number | null; // Standardabweichung
  isAmountStable: boolean;           // StdDev < 20% des Medians
  // MwSt-Pattern
  dominantVatRate: number | null;
  vatStability: number;              // 0.0–1.0
  vatHistory: Array<{ rate: number; count: number }>;
  // Meta
  totalApprovedDocs: number;
  isVerified: boolean;
  lastBookingDate: Date | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function stdDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function analyzeSupplierPatterns(
  companyId: string,
  supplierNameNormalized: string
): Promise<SupplierPattern | null> {
  // 1. Lade alle genehmigten Belege dieses Lieferanten
  const docs = await prisma.document.findMany({
    where: {
      companyId,
      supplierNameNormalized,
      status: { in: ["ready", "exported"] },
      reviewStatus: "approved",
      accountCode: { not: null },
    },
    select: {
      accountCode: true,
      grossAmount: true,
      vatRatesDetected: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (docs.length === 0) return null;

  // 2. Konto-Stabilität
  const accountCounts: Record<string, number> = {};
  for (const d of docs) {
    if (d.accountCode) accountCounts[d.accountCode] = (accountCounts[d.accountCode] || 0) + 1;
  }
  const accountHistory = Object.entries(accountCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  const dominantAccount = accountHistory[0]?.code || null;
  const accountStability = dominantAccount ? accountHistory[0].count / docs.length : 0;

  // 3. Betrags-Median und StdDev
  const amounts = docs
    .map((d) => (d.grossAmount ? Number(d.grossAmount) : null))
    .filter((v): v is number => v !== null && v > 0)
    .slice(0, 20);
  const typicalAmount = amounts.length > 0 ? median(amounts) : null;
  const amountStdDeviation = amounts.length > 0 ? stdDeviation(amounts) : null;
  const isAmountStable =
    amounts.length >= 3 &&
    typicalAmount !== null &&
    typicalAmount > 0 &&
    amountStdDeviation !== null &&
    amountStdDeviation / typicalAmount < 0.2;

  // 4. MwSt-Stabilität
  const vatCounts: Record<string, number> = {};
  for (const d of docs) {
    const rates = d.vatRatesDetected as any;
    if (Array.isArray(rates) && rates.length > 0 && typeof rates[0]?.rate === "number") {
      const key = String(rates[0].rate);
      vatCounts[key] = (vatCounts[key] || 0) + 1;
    }
  }
  const vatHistory = Object.entries(vatCounts)
    .map(([rate, count]) => ({ rate: Number(rate), count }))
    .sort((a, b) => b.count - a.count);
  const totalVatDocs = vatHistory.reduce((sum, v) => sum + v.count, 0);
  const dominantVatRate = vatHistory[0]?.rate ?? null;
  const vatStability = totalVatDocs > 0 && dominantVatRate !== null ? vatHistory[0].count / totalVatDocs : 0;

  // 5. Lade Supplier
  const supplier = await prisma.supplier.findFirst({
    where: { companyId, nameNormalized: supplierNameNormalized },
    select: { id: true, isVerified: true },
  });

  return {
    supplierId: supplier?.id || null,
    supplierName: supplierNameNormalized,
    dominantAccount,
    accountStability,
    accountHistory,
    typicalAmount,
    amountStdDeviation,
    isAmountStable,
    dominantVatRate,
    vatStability,
    vatHistory,
    totalApprovedDocs: docs.length,
    isVerified: supplier?.isVerified || false,
    lastBookingDate: docs[0]?.createdAt || null,
  };
}
