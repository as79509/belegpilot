import { prisma } from "@/lib/db";
import { computeModuleReadiness, computeReadinessScore, type ReadinessLevel } from "./wizard-service";
import { assessFailureModes } from "./failure-handler";

export interface GoLiveCheck {
  canGoLive: boolean;
  readinessScore: number;
  moduleReadiness: Record<string, ReadinessLevel>;
  blockers: string[];
  warnings: string[];
  recommendedGoLiveConfig: {
    autopilotMode: "shadow" | "prefill";
    reviewLevel: "strict" | "normal";
    monitoringLevel: "high" | "normal";
  };
  estimatedStabilizationDays: number;
}

export async function checkGoLiveReadiness(companyId: string, sessionId: string): Promise<GoLiveCheck> {
  const moduleReadiness = await computeModuleReadiness(companyId);
  const readinessScore = computeReadinessScore(moduleReadiness);

  // Load open KnownUnknowns
  const openUnknowns = await prisma.onboardingKnownUnknown.findMany({
    where: { sessionId, status: "open" },
  });

  const blockers: string[] = [];
  const warnings: string[] = [];

  // Blocker checks
  if (readinessScore < 0.3) {
    blockers.push("Gesamtreife zu niedrig (unter 30%)");
  }

  for (const u of openUnknowns) {
    if (u.blocksGoLive) {
      blockers.push(`Offene Blocker-Frage: ${u.description}`);
    }
  }

  if (moduleReadiness.stammdaten === "not_started") {
    blockers.push("Grunddaten nicht erfasst");
  }

  if (moduleReadiness.kontenplan === "not_started") {
    blockers.push("Kein Kontenplan importiert");
  }

  // Warning checks
  if (readinessScore < 0.5) {
    warnings.push("Reife unter 50% — verstärktes Monitoring empfohlen");
  }

  for (const [name, level] of Object.entries(moduleReadiness)) {
    if (level === "not_started" || level === "partial") {
      warnings.push(`Modul ${name} noch nicht bereit`);
    }
  }

  for (const u of openUnknowns) {
    if (u.criticality === "high" && !u.blocksGoLive) {
      warnings.push(`Wichtige offene Frage: ${u.description}`);
    }
  }

  // Failure assessment — add restrictions to warnings
  const failureAssessment = await assessFailureModes(companyId, sessionId);
  for (const restriction of failureAssessment.goLiveRestrictions) {
    warnings.push(restriction);
  }

  // Go-Live decision
  const canGoLive = blockers.length === 0;

  // Recommended config
  const recommendedGoLiveConfig = {
    autopilotMode: (readinessScore >= 0.7 ? "prefill" : "shadow") as "prefill" | "shadow",
    reviewLevel: (readinessScore >= 0.6 ? "normal" : "strict") as "normal" | "strict",
    monitoringLevel: (readinessScore >= 0.5 ? "normal" : "high") as "normal" | "high",
  };

  // Stabilization estimate
  const estimatedStabilizationDays =
    readinessScore >= 0.8 ? 7 :
    readinessScore >= 0.6 ? 14 :
    readinessScore >= 0.4 ? 21 : 30;

  return {
    canGoLive,
    readinessScore,
    moduleReadiness,
    blockers,
    warnings,
    recommendedGoLiveConfig,
    estimatedStabilizationDays,
  };
}
