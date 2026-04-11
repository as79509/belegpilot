import { prisma } from "@/lib/db";

export interface DriftReport {
  hasDrift: boolean;
  overallScore: number;
  signals: Array<{
    type: "correction_spike" | "accuracy_drop" | "confidence_drop" | "rejection_spike";
    message: string;
    currentValue: number;
    previousValue: number;
    threshold: number;
    severity: "warning" | "critical";
  }>;
  recommendation: "keep" | "downgrade" | "emergency_stop";
  recommendedMode: "shadow" | "prefill" | "auto_ready" | null;
}

export async function detectDrift(companyId: string, currentMode: string): Promise<DriftReport> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const currentFilter = { gte: d30, lte: now };
  const previousFilter = { gte: d60, lt: d30 };

  const [curApproved, curCorrections, curEvalTotal, curEvalCorrect, curRejected, curProcessed] = await Promise.all([
    prisma.document.count({ where: { companyId, reviewStatus: "approved", createdAt: currentFilter } }),
    prisma.correctionEvent.count({ where: { companyId, createdAt: currentFilter } }),
    prisma.suggestionEvaluation.count({ where: { companyId, createdAt: currentFilter } }),
    prisma.suggestionEvaluation.count({ where: { companyId, overallCorrect: true, createdAt: currentFilter } }),
    prisma.document.count({ where: { companyId, status: "rejected", createdAt: currentFilter } }),
    prisma.document.count({ where: { companyId, status: { in: ["ready", "exported", "needs_review", "rejected"] }, createdAt: currentFilter } }),
  ]);
  const curConfAgg = await prisma.bookingSuggestion.aggregate({ where: { companyId, createdAt: currentFilter }, _avg: { confidenceScore: true } });

  const [prevApproved, prevCorrections, prevEvalTotal, prevEvalCorrect, prevRejected, prevProcessed] = await Promise.all([
    prisma.document.count({ where: { companyId, reviewStatus: "approved", createdAt: previousFilter } }),
    prisma.correctionEvent.count({ where: { companyId, createdAt: previousFilter } }),
    prisma.suggestionEvaluation.count({ where: { companyId, createdAt: previousFilter } }),
    prisma.suggestionEvaluation.count({ where: { companyId, overallCorrect: true, createdAt: previousFilter } }),
    prisma.document.count({ where: { companyId, status: "rejected", createdAt: previousFilter } }),
    prisma.document.count({ where: { companyId, status: { in: ["ready", "exported", "needs_review", "rejected"] }, createdAt: previousFilter } }),
  ]);
  const prevConfAgg = await prisma.bookingSuggestion.aggregate({ where: { companyId, createdAt: previousFilter }, _avg: { confidenceScore: true } });

  const curCorrRate = curApproved > 0 ? curCorrections / curApproved : 0;
  const prevCorrRate = prevApproved > 0 ? prevCorrections / prevApproved : 0;
  const curAccuracy = curEvalTotal > 0 ? curEvalCorrect / curEvalTotal : 0;
  const prevAccuracy = prevEvalTotal > 0 ? prevEvalCorrect / prevEvalTotal : 0;
  const curConf = curConfAgg._avg.confidenceScore ?? 0;
  const prevConf = prevConfAgg._avg.confidenceScore ?? 0;
  const curRejRate = curProcessed > 0 ? curRejected / curProcessed : 0;
  const prevRejRate = prevProcessed > 0 ? prevRejected / prevProcessed : 0;

  const signals: DriftReport["signals"] = [];

  if (prevCorrRate > 0 && curCorrRate > prevCorrRate) {
    const increase = (curCorrRate - prevCorrRate) / prevCorrRate;
    if (increase > 1.0) {
      signals.push({ type: "correction_spike", message: "Korrekturrate um " + Math.round(increase * 100) + "% gestiegen", currentValue: curCorrRate, previousValue: prevCorrRate, threshold: 1.0, severity: "critical" });
    } else if (increase > 0.5) {
      signals.push({ type: "correction_spike", message: "Korrekturrate um " + Math.round(increase * 100) + "% gestiegen", currentValue: curCorrRate, previousValue: prevCorrRate, threshold: 0.5, severity: "warning" });
    }
  }

  if (prevAccuracy > 0 && curAccuracy < prevAccuracy) {
    const drop = (prevAccuracy - curAccuracy) / prevAccuracy;
    if (drop > 0.2) {
      signals.push({ type: "accuracy_drop", message: "Autopilot-Genauigkeit um " + Math.round(drop * 100) + "% gesunken", currentValue: curAccuracy, previousValue: prevAccuracy, threshold: 0.2, severity: "critical" });
    } else if (drop > 0.1) {
      signals.push({ type: "accuracy_drop", message: "Autopilot-Genauigkeit um " + Math.round(drop * 100) + "% gesunken", currentValue: curAccuracy, previousValue: prevAccuracy, threshold: 0.1, severity: "warning" });
    }
  }

  if (prevConf > 0 && curConf < prevConf) {
    const drop = (prevConf - curConf) / prevConf;
    if (drop > 0.15) {
      signals.push({ type: "confidence_drop", message: "Konfidenz um " + Math.round(drop * 100) + "% gesunken", currentValue: curConf, previousValue: prevConf, threshold: 0.15, severity: "warning" });
    }
  }

  if (prevRejRate > 0 && curRejRate > prevRejRate) {
    const increase = (curRejRate - prevRejRate) / prevRejRate;
    if (increase > 1.0) {
      signals.push({ type: "rejection_spike", message: "Ablehnungsrate um " + Math.round(increase * 100) + "% gestiegen", currentValue: curRejRate, previousValue: prevRejRate, threshold: 1.0, severity: "warning" });
    }
  }

  let overallScore = 100;
  for (const s of signals) overallScore -= s.severity === "critical" ? 30 : 15;
  overallScore = Math.max(0, overallScore);

  let recommendation: DriftReport["recommendation"];
  if (overallScore >= 70) recommendation = "keep";
  else if (overallScore >= 40) recommendation = "downgrade";
  else recommendation = "emergency_stop";

  let recommendedMode: DriftReport["recommendedMode"] = null;
  if (recommendation === "downgrade") {
    if (currentMode === "auto_ready") recommendedMode = "prefill";
    else if (currentMode === "prefill") recommendedMode = "shadow";
  } else if (recommendation === "emergency_stop") {
    recommendedMode = "shadow";
  }

  return { hasDrift: signals.length > 0, overallScore, signals, recommendation, recommendedMode };
}
