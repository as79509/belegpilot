import { prisma } from "@/lib/db";

export interface TelemetrySnapshot {
  // Operative Stabilität
  pipeline: {
    totalUploaded: number;
    totalProcessed: number;
    successRate: number;          // processed / uploaded
    stuckProcessing: number;      // status="processing" > 1h
    failedCount: number;
    avgProcessingTimeMs: number | null;  // Durchschnitt upload→ready
  };

  // Suggestion Quality
  suggestions: {
    coverage: number;            // % Belege mit Suggestion
    totalExposed: number;
    acceptedCount: number;
    rejectedCount: number;
    modifiedCount: number;
    acceptanceRate: number;      // (accepted + modified) / total
    modifiedRate: number;        // modified / total
    topFieldAccuracy: {          // Pro Feld: wie oft korrekt?
      accountCode: number;
      expenseCategory: number;
      costCenter: number;
    };
  };

  // Autopilot
  autopilot: {
    totalEvents: number;
    eligibleCount: number;
    blockedCount: number;
    eligibleRate: number;
    autoReadyCount: number;      // Tatsächlich auto-ready gesetzte
    prefillCount: number;
    shadowCount: number;
    postAutopilotCorrectionRate: number;  // Wie oft wurde auto-ready nachher korrigiert?
    topBlockReasons: Array<{ reason: string; count: number }>;
  };

  // Drift Detection
  drift: {
    alerts: Array<{
      supplierId: string;
      supplierName: string;
      type: "vat_change" | "amount_spike" | "account_instability" | "new_pattern";
      detail: string;
      severity: "warning" | "critical";
    }>;
  };

  // Confidence Calibration
  calibration: {
    highConfidenceAccuracy: number;   // Bei confidence "high": wie oft tatsächlich korrekt?
    mediumConfidenceAccuracy: number;
    lowConfidenceAccuracy: number;
    isCalibrated: boolean;            // high > medium > low?
  };

  // Correction Trends
  corrections: {
    totalEvents: number;
    openPatterns: number;
    promotedPatterns: number;
    topCorrectedFields: Array<{ field: string; count: number }>;
    topCorrectedSuppliers: Array<{ name: string; count: number }>;
  };

  period: { from: Date; to: Date };
}

export async function computeTelemetry(
  companyId: string,
  daysBack: number = 30
): Promise<TelemetrySnapshot> {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const to = new Date();
  const dateFilter = { gte: from, lte: to };

  // --- Pipeline ---
  const [totalUploaded, totalProcessed, failedCount, stuckProcessing] = await Promise.all([
    prisma.document.count({ where: { companyId, createdAt: dateFilter } }),
    prisma.document.count({
      where: {
        companyId,
        status: { in: ["ready", "exported", "needs_review"] },
        createdAt: dateFilter,
      },
    }),
    prisma.document.count({ where: { companyId, status: "failed", createdAt: dateFilter } }),
    prisma.document.count({
      where: {
        companyId,
        status: "processing",
        createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
  ]);

  // --- Suggestions ---
  const [totalSuggestions, acceptedSugg, rejectedSugg, modifiedSugg] = await Promise.all([
    prisma.bookingSuggestion.count({ where: { companyId, createdAt: dateFilter } }),
    prisma.bookingSuggestion.count({
      where: { companyId, status: "accepted", createdAt: dateFilter },
    }),
    prisma.bookingSuggestion.count({
      where: { companyId, status: "rejected", createdAt: dateFilter },
    }),
    prisma.bookingSuggestion.count({
      where: { companyId, status: "modified", createdAt: dateFilter },
    }),
  ]);
  const docsWithSuggestion = await prisma.bookingSuggestion.groupBy({
    by: ["documentId"],
    where: { companyId, createdAt: dateFilter },
  });

  // --- Autopilot ---
  const [apTotal, apEligible, apBlocked] = await Promise.all([
    prisma.autopilotEvent.count({ where: { companyId, createdAt: dateFilter } }),
    prisma.autopilotEvent.count({
      where: { companyId, decision: "eligible", createdAt: dateFilter },
    }),
    prisma.autopilotEvent.count({
      where: { companyId, decision: "blocked", createdAt: dateFilter },
    }),
  ]);

  // Top Block Reasons
  const blockedEvents = await prisma.autopilotEvent.findMany({
    where: { companyId, decision: "blocked", blockedBy: { not: null }, createdAt: dateFilter },
    select: { blockedBy: true },
  });
  const blockCounts: Record<string, number> = {};
  for (const e of blockedEvents) {
    if (e.blockedBy) blockCounts[e.blockedBy] = (blockCounts[e.blockedBy] || 0) + 1;
  }
  const topBlockReasons = Object.entries(blockCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // --- Corrections ---
  const [totalCorrEvents, openPatterns, promotedPatterns] = await Promise.all([
    prisma.correctionEvent.count({ where: { companyId, createdAt: dateFilter } }),
    prisma.correctionPattern.count({
      where: { companyId, status: "open", occurrences: { gte: 3 } },
    }),
    prisma.correctionPattern.count({ where: { companyId, status: "promoted" } }),
  ]);

  // Top corrected fields
  const corrEvents = await prisma.correctionEvent.findMany({
    where: { companyId, createdAt: dateFilter },
    select: { field: true, supplierId: true },
  });
  const fieldCounts: Record<string, number> = {};
  const supplierCorrCounts: Record<string, number> = {};
  for (const e of corrEvents) {
    fieldCounts[e.field] = (fieldCounts[e.field] || 0) + 1;
    if (e.supplierId) supplierCorrCounts[e.supplierId] = (supplierCorrCounts[e.supplierId] || 0) + 1;
  }

  // Resolve supplier names for top corrected
  const topSupplierIds = Object.entries(supplierCorrCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
  const suppliers = topSupplierIds.length > 0
    ? await prisma.supplier.findMany({
        where: { id: { in: topSupplierIds } },
        select: { id: true, nameNormalized: true },
      })
    : [];
  const supplierNameMap = new Map(suppliers.map((s) => [s.id, s.nameNormalized]));

  // --- Drift Detection ---
  const driftAlerts: TelemetrySnapshot["drift"]["alerts"] = [];

  // Finde Lieferanten mit instabilen Mustern (Stabilität unter 0.7 bei mind. 5 Belegen)
  const activeSuppliers = await prisma.supplier.findMany({
    where: { companyId, isVerified: true },
    select: { id: true, nameNormalized: true },
    take: 50,
  });
  for (const supplier of activeSuppliers) {
    const recentDocs = await prisma.document.findMany({
      where: {
        companyId,
        supplierNameNormalized: supplier.nameNormalized,
        status: { in: ["ready", "exported"] },
        reviewStatus: "approved",
        createdAt: dateFilter,
      },
      select: { accountCode: true, grossAmount: true, vatRatesDetected: true },
      take: 20,
    });
    if (recentDocs.length < 3) continue;

    // Konto-Instabilität
    const accountCodes = recentDocs.map((d) => d.accountCode).filter(Boolean) as string[];
    const uniqueAccounts = new Set(accountCodes);
    if (uniqueAccounts.size > 2 && accountCodes.length >= 5) {
      driftAlerts.push({
        supplierId: supplier.id,
        supplierName: supplier.nameNormalized,
        type: "account_instability",
        detail: `${uniqueAccounts.size} verschiedene Konten in ${accountCodes.length} Belegen`,
        severity: "warning",
      });
    }

    // Betrags-Spike
    const amounts = recentDocs
      .map((d) => (d.grossAmount ? Number(d.grossAmount) : 0))
      .filter((a) => a > 0);
    if (amounts.length >= 3) {
      const sorted = [...amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const latest = amounts[0]; // Neuester Beleg
      if (median > 0 && latest > median * 1.5) {
        driftAlerts.push({
          supplierId: supplier.id,
          supplierName: supplier.nameNormalized,
          type: "amount_spike",
          detail: `Letzter Betrag CHF ${latest.toFixed(2)} ist ${Math.round((latest / median - 1) * 100)}% über Median CHF ${median.toFixed(2)}`,
          severity: latest > median * 2 ? "critical" : "warning",
        });
      }
    }

    // MwSt-Wechsel
    const vatRates = recentDocs
      .map((d) => {
        const rates = d.vatRatesDetected as any;
        return Array.isArray(rates) && rates[0]?.rate != null ? rates[0].rate : null;
      })
      .filter((r): r is number => r !== null);
    const uniqueVat = new Set(vatRates);
    if (uniqueVat.size > 1 && vatRates.length >= 3) {
      driftAlerts.push({
        supplierId: supplier.id,
        supplierName: supplier.nameNormalized,
        type: "vat_change",
        detail: `MwSt-Sätze wechselnd: ${[...uniqueVat].join("%, ")}%`,
        severity: "warning",
      });
    }
  }

  // --- Confidence Calibration ---
  // Vergleiche: Bei "high" confidence Suggestions — wie oft wurde NICHT korrigiert?
  const [highSugg, medSugg, lowSugg] = await Promise.all([
    prisma.bookingSuggestion.findMany({
      where: {
        companyId,
        confidenceLevel: "high",
        status: { in: ["accepted", "modified", "rejected"] },
        createdAt: dateFilter,
      },
      select: { status: true },
    }),
    prisma.bookingSuggestion.findMany({
      where: {
        companyId,
        confidenceLevel: "medium",
        status: { in: ["accepted", "modified", "rejected"] },
        createdAt: dateFilter,
      },
      select: { status: true },
    }),
    prisma.bookingSuggestion.findMany({
      where: {
        companyId,
        confidenceLevel: "low",
        status: { in: ["accepted", "modified", "rejected"] },
        createdAt: dateFilter,
      },
      select: { status: true },
    }),
  ]);

  const calcAccuracy = (items: { status: string }[]) => {
    if (items.length === 0) return 0;
    return items.filter((i) => i.status === "accepted").length / items.length;
  };

  const highAcc = calcAccuracy(highSugg);
  const medAcc = calcAccuracy(medSugg);
  const lowAcc = calcAccuracy(lowSugg);

  // ── avgProcessingTimeMs: Durchschnitt durationMs aller completed Steps ──
  const avgProcessingResult = await prisma.processingStep.aggregate({
    where: {
      status: "completed",
      durationMs: { not: null },
      startedAt: dateFilter,
      document: { companyId },
    },
    _avg: { durationMs: true },
  });
  const avgProcessingTimeMs = avgProcessingResult._avg.durationMs ?? null;

  // ── autoReadyCount, prefillCount, shadowCount: echte Autopilot-Zählung ──
  const [autoReadyCount, prefillCount, shadowCount] = await Promise.all([
    prisma.autopilotEvent.count({
      where: { companyId, decision: "eligible", mode: "auto_ready", createdAt: dateFilter },
    }),
    prisma.autopilotEvent.count({
      where: { companyId, decision: "eligible", mode: "prefill", createdAt: dateFilter },
    }),
    prisma.autopilotEvent.count({
      where: { companyId, decision: "eligible", mode: "shadow", createdAt: dateFilter },
    }),
  ]);

  // ── SuggestionEvaluations laden (für topFieldAccuracy + postAutopilotCorrectionRate) ──
  const evaluations = await prisma.suggestionEvaluation.findMany({
    where: {
      companyId,
      createdAt: { gte: from },
      source: { in: ["suggestion_accept", "suggestion_modify", "autopilot_auto_ready"] },
    },
    select: {
      accountCorrect: true,
      categoryCorrect: true,
      costCenterCorrect: true,
      vatCodeCorrect: true,
      source: true,
    },
  });

  // ── postAutopilotCorrectionRate: Echte Rate aus Evaluations, Fallback auf CorrectionEvents ──
  let postAutopilotCorrectionRate = 0;
  const autopilotEvals = evaluations.filter((e) => e.source === "autopilot_auto_ready");
  if (autopilotEvals.length > 0) {
    postAutopilotCorrectionRate =
      1 -
      autopilotEvals.filter(
        (e) => e.accountCorrect === true && e.categoryCorrect !== false
      ).length /
        autopilotEvals.length;
  } else if (autoReadyCount > 0) {
    // Fallback auf CorrectionEvents
    const autoReadyEvents = await prisma.autopilotEvent.findMany({
      where: { companyId, decision: "eligible", mode: "auto_ready", createdAt: dateFilter },
      select: { documentId: true },
      take: 500,
    });
    const autoReadyDocIds = [...new Set(autoReadyEvents.map((e) => e.documentId))];

    if (autoReadyDocIds.length > 0) {
      const correctedCount = await prisma.correctionEvent.groupBy({
        by: ["documentId"],
        where: { documentId: { in: autoReadyDocIds }, companyId },
      });
      postAutopilotCorrectionRate = correctedCount.length / autoReadyDocIds.length;
    }
  }

  let topFieldAccuracy: { accountCode: number; expenseCategory: number; costCenter: number };

  if (evaluations.length > 0) {
    const countTrue = (field: "accountCorrect" | "categoryCorrect" | "costCenterCorrect" | "vatCodeCorrect") => {
      const relevant = evaluations.filter((e) => e[field] !== null);
      if (relevant.length === 0) return 0;
      return relevant.filter((e) => e[field] === true).length / relevant.length;
    };

    topFieldAccuracy = {
      accountCode: countTrue("accountCorrect"),
      expenseCategory: countTrue("categoryCorrect"),
      costCenter: countTrue("costCenterCorrect"),
    };
  } else {
    // Fallback auf Proxy wenn noch keine Evaluations vorhanden
    const suggestionOutcomes = await prisma.bookingSuggestion.groupBy({
      by: ["status"],
      where: { companyId, createdAt: dateFilter },
      _count: true,
    });
    const suggOutcomeCounts = Object.fromEntries(
      suggestionOutcomes.map((s) => [s.status, s._count])
    );
    const totalSuggOutcomes = suggestionOutcomes.reduce((sum, s) => sum + s._count, 0) || 1;
    const suggAccepted = suggOutcomeCounts["accepted"] || 0;
    const suggModified = suggOutcomeCounts["modified"] || 0;
    topFieldAccuracy = {
      accountCode: (suggAccepted + suggModified * 0.3) / totalSuggOutcomes,
      expenseCategory: (suggAccepted + suggModified * 0.3) / totalSuggOutcomes,
      costCenter: (suggAccepted + suggModified * 0.5) / totalSuggOutcomes,
    };
  }

  return {
    pipeline: {
      totalUploaded,
      totalProcessed,
      successRate: totalUploaded > 0 ? totalProcessed / totalUploaded : 0,
      stuckProcessing,
      failedCount,
      avgProcessingTimeMs,
    },
    suggestions: {
      coverage: totalUploaded > 0 ? docsWithSuggestion.length / totalUploaded : 0,
      totalExposed: totalSuggestions,
      acceptedCount: acceptedSugg,
      rejectedCount: rejectedSugg,
      modifiedCount: modifiedSugg,
      acceptanceRate:
        totalSuggestions > 0 ? (acceptedSugg + modifiedSugg) / totalSuggestions : 0,
      modifiedRate: totalSuggestions > 0 ? modifiedSugg / totalSuggestions : 0,
      topFieldAccuracy,
    },
    autopilot: {
      totalEvents: apTotal,
      eligibleCount: apEligible,
      blockedCount: apBlocked,
      eligibleRate: apTotal > 0 ? apEligible / apTotal : 0,
      autoReadyCount,
      prefillCount,
      shadowCount,
      postAutopilotCorrectionRate,
      topBlockReasons,
    },
    drift: { alerts: driftAlerts },
    calibration: {
      highConfidenceAccuracy: highAcc,
      mediumConfidenceAccuracy: medAcc,
      lowConfidenceAccuracy: lowAcc,
      isCalibrated: highAcc >= medAcc && medAcc >= lowAcc && highSugg.length >= 5,
    },
    corrections: {
      totalEvents: totalCorrEvents,
      openPatterns,
      promotedPatterns,
      topCorrectedFields: Object.entries(fieldCounts)
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topCorrectedSuppliers: Object.entries(supplierCorrCounts)
        .map(([id, count]) => ({ name: supplierNameMap.get(id) || id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    },
    period: { from, to },
  };
}
