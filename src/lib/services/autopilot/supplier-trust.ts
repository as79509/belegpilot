import { prisma } from "@/lib/db";

export interface SupplierTrustScore {
  supplierId: string;
  supplierName: string;
  trustScore: number;
  factors: {
    documentCount: number;
    correctionRate: number;
    accountStability: number;
    vatStability: number;
    autopilotAccuracy: number;
    bananaChangeRate: number;
  };
  recommendedMode: "shadow" | "prefill" | "auto_ready";
  riskLevel: "low" | "medium" | "high";
}

export async function computeSupplierTrustScores(companyId: string): Promise<SupplierTrustScore[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    select: { id: true, nameNormalized: true },
  });

  const results: SupplierTrustScore[] = [];

  for (const supplier of suppliers) {
    const docs = await prisma.document.findMany({
      where: { companyId, supplierId: supplier.id, status: { in: ["ready", "exported", "needs_review"] } },
      select: { id: true, accountCode: true, vatRatesDetected: true },
    });
    const documentCount = docs.length;
    if (documentCount < 3) continue;

    const docIds = docs.map((d) => d.id);

    const correctionCount = await prisma.correctionEvent.count({ where: { companyId, documentId: { in: docIds } } });
    const correctionRate = documentCount > 0 ? correctionCount / documentCount : 0;

    const accountCodes = docs.map((d) => d.accountCode).filter(Boolean) as string[];
    let accountStability = 0;
    if (accountCodes.length > 0) {
      const freq: Record<string, number> = {};
      for (const ac of accountCodes) freq[ac] = (freq[ac] || 0) + 1;
      accountStability = Math.max(...Object.values(freq)) / accountCodes.length;
    }

    const vatRates = docs.map((d) => {
      const rates = d.vatRatesDetected as any;
      return Array.isArray(rates) && rates[0]?.rate != null ? String(rates[0].rate) : null;
    }).filter(Boolean) as string[];
    let vatStability = 0;
    if (vatRates.length > 0) {
      const freq: Record<string, number> = {};
      for (const vr of vatRates) freq[vr] = (freq[vr] || 0) + 1;
      vatStability = Math.max(...Object.values(freq)) / vatRates.length;
    }

    const evalTotal = await prisma.suggestionEvaluation.count({ where: { companyId, documentId: { in: docIds } } });
    const evalCorrect = await prisma.suggestionEvaluation.count({ where: { companyId, documentId: { in: docIds }, overallCorrect: true } });
    const autopilotAccuracy = evalTotal > 0 ? evalCorrect / evalTotal : 0;

    const bananaMatched = await prisma.bananaRoundTripEntry.count({ where: { companyId, documentId: { in: docIds }, matchStatus: { in: ["matched", "modified"] } } });
    const bananaModified = await prisma.bananaRoundTripEntry.count({ where: { companyId, documentId: { in: docIds }, matchStatus: "modified" } });
    const bananaChangeRate = bananaMatched > 0 ? bananaModified / bananaMatched : 0;

    const trustScore = Math.round(Math.min(100, Math.max(0,
      (1 - correctionRate) * 30 + accountStability * 20 + vatStability * 15 + autopilotAccuracy * 25 + (1 - bananaChangeRate) * 10 + (documentCount > 20 ? 5 : 0)
    )));

    const recommendedMode: SupplierTrustScore["recommendedMode"] = trustScore >= 80 ? "auto_ready" : trustScore >= 50 ? "prefill" : "shadow";
    const riskLevel: SupplierTrustScore["riskLevel"] = trustScore >= 70 ? "low" : trustScore >= 40 ? "medium" : "high";

    results.push({
      supplierId: supplier.id,
      supplierName: supplier.nameNormalized,
      trustScore,
      factors: { documentCount, correctionRate, accountStability, vatStability, autopilotAccuracy, bananaChangeRate },
      recommendedMode,
      riskLevel,
    });
  }

  return results.sort((a, b) => b.trustScore - a.trustScore);
}
