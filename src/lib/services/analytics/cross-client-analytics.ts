import { prisma } from "@/lib/db";

export interface ClientAnalytics {
  companyId: string;
  companyName: string;
  totalDocuments: number;
  processedDocuments: number;
  needsReviewCount: number;
  failedCount: number;
  correctionRate: number;
  autopilotEligibleRate: number;
  avgConfidence: number;
  currentPeriodQuality: number | null;
  openPeriodsCount: number;
  unmatchedTransactions: number;
  overdueDocuments: number;
  bananaMappingRate: number;
  lastExportDate: string | null;
  riskScore: number;
  riskFactors: string[];
}

export interface CrossClientSummary {
  clients: ClientAnalytics[];
  totalClients: number;
  avgCorrectionRate: number;
  avgAutopilotEligibleRate: number;
  avgPeriodQuality: number;
  clientsNeedingAttention: number;
  dataQualityGate: {
    sufficientData: boolean;
    message: string | null;
  };
}

async function computeClientAnalytics(companyId: string, companyName: string): Promise<ClientAnalytics> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [
    totalDocuments,
    processedDocuments,
    needsReviewCount,
    failedCount,
    correctionCount,
    approvedCount,
    autopilotTotal,
    autopilotEligible,
    avgConfidenceResult,
    currentPeriod,
    openPeriodsCount,
    unmatchedTransactions,
    overdueDocuments,
    totalActiveAccounts,
    mappedAccounts,
    lastExport,
  ] = await Promise.all([
    prisma.document.count({ where: { companyId } }),
    prisma.document.count({
      where: { companyId, status: { notIn: ["uploaded", "processing"] } },
    }),
    prisma.document.count({ where: { companyId, status: "needs_review" } }),
    prisma.document.count({ where: { companyId, status: "failed" } }),
    prisma.correctionEvent.count({ where: { companyId } }),
    prisma.document.count({
      where: { companyId, status: { in: ["ready", "exported"] } },
    }),
    prisma.autopilotEvent.count({ where: { companyId } }),
    prisma.autopilotEvent.count({ where: { companyId, decision: "eligible" } }),
    prisma.bookingSuggestion.aggregate({
      where: { companyId },
      _avg: { confidenceScore: true },
    }),
    prisma.monthlyPeriod.findFirst({
      where: { companyId, year: currentYear, month: currentMonth },
      select: {
        status: true,
        documentsExpected: true,
        documentsReceived: true,
        recurringGenerated: true,
        depreciationGenerated: true,
        vatChecked: true,
        exportCompleted: true,
      },
    }),
    prisma.monthlyPeriod.count({ where: { companyId, status: "open" } }),
    prisma.bankTransaction.count({
      where: { companyId, matchStatus: "unmatched" },
    }),
    prisma.document.count({
      where: {
        companyId,
        dueDate: { lt: now },
        status: { notIn: ["exported", "ready", "archived"] },
      },
    }),
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.account.count({
      where: { companyId, isActive: true, bananaMappingStatus: "mapped" },
    }),
    prisma.exportRecord.findFirst({
      where: { exportTarget: "banana", document: { companyId } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const correctionRate = approvedCount > 0 ? correctionCount / approvedCount : 0;
  const autopilotEligibleRate = autopilotTotal > 0 ? autopilotEligible / autopilotTotal : 0;
  const avgConfidence = avgConfidenceResult._avg.confidenceScore ?? 0;
  const bananaMappingRate = totalActiveAccounts > 0 ? mappedAccounts / totalActiveAccounts : 0;

  // Period quality: simple checklist-based score (0-100)
  let currentPeriodQuality: number | null = null;
  if (currentPeriod) {
    let score = 0;
    const checks = [
      currentPeriod.documentsReceived >= currentPeriod.documentsExpected || currentPeriod.documentsExpected === 0,
      currentPeriod.recurringGenerated,
      currentPeriod.depreciationGenerated,
      currentPeriod.vatChecked,
      currentPeriod.exportCompleted,
    ];
    score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    currentPeriodQuality = score;
  }

  // Risk score calculation
  let riskScore = 0;
  const riskFactors: string[] = [];

  if (correctionRate > 0.3) {
    riskScore += 20;
    riskFactors.push("highCorrectionRate");
  }
  if (needsReviewCount > 10) {
    riskScore += 15;
    riskFactors.push("manyNeedsReview");
  }
  if (overdueDocuments > 3) {
    riskScore += 15;
    riskFactors.push("overdueDocuments");
  }
  if (unmatchedTransactions > 5) {
    riskScore += 10;
    riskFactors.push("unmatchedTransactions");
  }
  if (currentPeriodQuality !== null && currentPeriodQuality < 70) {
    riskScore += 10;
    riskFactors.push("lowPeriodQuality");
  }
  if (bananaMappingRate < 0.8) {
    riskScore += 10;
    riskFactors.push("lowBananaMapping");
  }
  if (avgConfidence > 0 && avgConfidence < 0.6) {
    riskScore += 5;
    riskFactors.push("lowConfidence");
  }

  return {
    companyId,
    companyName,
    totalDocuments,
    processedDocuments,
    needsReviewCount,
    failedCount,
    correctionRate,
    autopilotEligibleRate,
    avgConfidence,
    currentPeriodQuality,
    openPeriodsCount,
    unmatchedTransactions,
    overdueDocuments,
    bananaMappingRate,
    lastExportDate: lastExport?.createdAt?.toISOString() ?? null,
    riskScore: Math.min(riskScore, 100),
    riskFactors,
  };
}

export async function computeCrossClientAnalytics(
  userId: string
): Promise<CrossClientSummary> {
  // Load companies the user manages (admin or trustee role)
  const userCompanies = await prisma.userCompany.findMany({
    where: {
      userId,
      role: { in: ["admin", "trustee"] },
    },
    include: { company: { select: { id: true, name: true } } },
  });

  // Compute analytics for each company in parallel
  const clients = await Promise.all(
    userCompanies.map((uc) =>
      computeClientAnalytics(uc.companyId, uc.company.name)
    )
  );

  // Sort by riskScore DESC
  clients.sort((a, b) => b.riskScore - a.riskScore);

  // Data quality gate: at least 3 clients with >10 documents
  const clientsWithData = clients.filter((c) => c.totalDocuments > 10);
  const sufficientData = clientsWithData.length >= 3;

  // Averages (only from clients with sufficient data)
  const pool = clientsWithData.length > 0 ? clientsWithData : clients;
  const avgCorrectionRate =
    pool.length > 0
      ? pool.reduce((s, c) => s + c.correctionRate, 0) / pool.length
      : 0;
  const avgAutopilotEligibleRate =
    pool.length > 0
      ? pool.reduce((s, c) => s + c.autopilotEligibleRate, 0) / pool.length
      : 0;
  const qualityClients = pool.filter((c) => c.currentPeriodQuality !== null);
  const avgPeriodQuality =
    qualityClients.length > 0
      ? qualityClients.reduce((s, c) => s + (c.currentPeriodQuality ?? 0), 0) / qualityClients.length
      : 0;

  const clientsNeedingAttention = clients.filter((c) => c.riskScore > 60).length;

  return {
    clients,
    totalClients: clients.length,
    avgCorrectionRate,
    avgAutopilotEligibleRate,
    avgPeriodQuality,
    clientsNeedingAttention,
    dataQualityGate: {
      sufficientData,
      message: sufficientData
        ? null
        : "Zu wenige Daten für belastbare Vergleiche. Mindestens 3 Mandanten mit je 10+ Belegen benötigt.",
    },
  };
}
