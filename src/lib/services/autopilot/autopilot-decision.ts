import { prisma } from "@/lib/db";
import { runSafetyChecks, SafetyCheckResult } from "./safety-check";
import { generateSuggestion } from "@/lib/services/suggestions/suggestion-engine";

export interface AutopilotDecision {
  mode: "shadow" | "prefill" | "auto_ready" | "disabled";
  eligible: boolean;
  safetyResult: SafetyCheckResult;
  suggestion: any | null;
  action: "none" | "prefill" | "auto_ready";
}

export async function evaluateAutopilot(
  companyId: string,
  document: {
    id: string;
    supplierNameNormalized: string | null;
    supplierId: string | null;
    grossAmount: number | null;
    currency: string | null;
    documentType: string;
    invoiceDate: Date | null;
    confidenceScore: number | null;
    decisionReasons: any;
    expenseCategory: string | null;
    vatRatesDetected: any;
  }
): Promise<AutopilotDecision> {
  // 1. Lade AutopilotConfig
  const config = await prisma.autopilotConfig.findUnique({
    where: { companyId },
  });

  // Kein Config oder disabled oder Kill Switch aktiv → disabled
  if (!config || !config.enabled || config.killSwitchActive) {
    return {
      mode: "disabled",
      eligible: false,
      safetyResult: { eligible: false, checks: {}, blockedBy: "autopilot_disabled" },
      suggestion: null,
      action: "none",
    };
  }

  // 2. Safety Checks
  const safetyResult = await runSafetyChecks(companyId, document, {
    minHistoryMatches: config.minHistoryMatches,
    minStabilityScore: config.minStabilityScore,
    maxAmount: config.maxAmount,
    minConfidence: config.minConfidence,
    allowedDocTypes: config.allowedDocTypes as string[] | null,
    allowedCurrencies: config.allowedCurrencies as string[] | null,
    supplierAllowlist: config.supplierAllowlist as string[] | null,
  });

  // 3. Suggestion laden (für Prefill/Auto-Ready)
  let suggestion = null;
  if (safetyResult.eligible) {
    suggestion = await generateSuggestion(companyId, {
      supplierNameNormalized: document.supplierNameNormalized,
      grossAmount: document.grossAmount,
      currency: document.currency,
      vatRatesDetected: document.vatRatesDetected,
      expenseCategory: document.expenseCategory,
      documentType: document.documentType,
    });
  }

  // 3b. Konto-Governance für vorgeschlagenes Konto prüfen
  // Der bestehende Safety-Check (accountGovernance) prüft nur document.accountCode.
  // Hier prüfen wir zusätzlich das VORGESCHLAGENE Konto aus der Suggestion.
  if (suggestion?.suggestedAccount) {
    const suggestedAccountRecord = await prisma.account.findFirst({
      where: {
        companyId,
        accountNumber: suggestion.suggestedAccount,
        isActive: true,
      },
      select: { aiGovernance: true, accountNumber: true },
    });

    if (!suggestedAccountRecord) {
      safetyResult.eligible = false;
      safetyResult.checks.suggestedAccountGovernance = {
        passed: false,
        detail: "Vorgeschlagenes Konto " + suggestion.suggestedAccount + " nicht im Kontenplan",
      };
      safetyResult.blockedBy = safetyResult.blockedBy || "suggestedAccountGovernance";
    } else if (suggestedAccountRecord.aiGovernance !== "ai_autopilot") {
      safetyResult.eligible = false;
      safetyResult.checks.suggestedAccountGovernance = {
        passed: false,
        detail: "Vorgeschlagenes Konto " + suggestion.suggestedAccount + " ist " + suggestedAccountRecord.aiGovernance + ", nicht ai_autopilot",
      };
      safetyResult.blockedBy = safetyResult.blockedBy || "suggestedAccountGovernance";
    } else {
      safetyResult.checks.suggestedAccountGovernance = {
        passed: true,
        detail: "Vorgeschlagenes Konto " + suggestion.suggestedAccount + " ist für Autopilot freigegeben",
      };
    }
  }

  // Wenn Governance blockiert hat, keine Suggestion verwenden
  if (!safetyResult.eligible) {
    suggestion = null;
  }

  // 4. Bestimme Aktion basierend auf Mode
  let action: "none" | "prefill" | "auto_ready" = "none";

  if (safetyResult.eligible && suggestion) {
    if (config.mode === "shadow") {
      action = "none"; // Nur beobachten
    } else if (config.mode === "prefill") {
      action = "prefill";
    } else if (config.mode === "auto_ready") {
      action = "auto_ready";
    }
  }

  // 5. AutopilotEvent loggen mit vollständigem Decision Snapshot
  // safetyChecks ist Json — wir erweitern es um Snapshot-Daten für späteres Replay
  const decisionSnapshot = {
    checks: safetyResult.checks,
    suggestion: suggestion
      ? {
          suggestedAccount: suggestion.suggestedAccount || null,
          suggestedCategory: suggestion.suggestedCategory || null,
          suggestedCostCenter: suggestion.suggestedCostCenter || null,
          suggestedVatCode: suggestion.suggestedVatCode || null,
          confidenceLevel: suggestion.confidenceLevel || null,
          confidenceScore: suggestion.confidenceScore || null,
          matchedDocCount: suggestion.matchedDocCount || null,
          consistencyRate: suggestion.consistencyRate || null,
        }
      : null,
    mode: config.mode,
    action,
    eligible: safetyResult.eligible,
    blockedBy: safetyResult.blockedBy,
    decidedAt: new Date().toISOString(),
  };

  await prisma.autopilotEvent.create({
    data: {
      companyId,
      documentId: document.id,
      mode: config.mode,
      decision: safetyResult.eligible ? "eligible" : "blocked",
      safetyChecks: decisionSnapshot as any,
      blockedBy: safetyResult.blockedBy,
      confidenceScore: document.confidenceScore || 0,
      suggestedAccount: suggestion?.suggestedAccount || null,
      supplierName: document.supplierNameNormalized,
    },
  });

  return {
    mode: config.mode as any,
    eligible: safetyResult.eligible,
    safetyResult,
    suggestion,
    action,
  };
}

export async function checkAndApplyDrift(
  companyId: string
): Promise<{ downgraded: boolean; from: string | null; to: string | null; reason: string | null }> {
  const { detectDrift } = await import("./drift-detection");
  const config = await prisma.autopilotConfig.findUnique({ where: { companyId } });

  if (!config || !config.enabled || config.killSwitchActive || config.mode === "shadow") {
    return { downgraded: false, from: null, to: null, reason: null };
  }

  const driftReport = await detectDrift(companyId, config.mode);

  if (driftReport.recommendation === "keep" || !driftReport.recommendedMode) {
    return { downgraded: false, from: null, to: null, reason: null };
  }

  const from = config.mode;
  const to = driftReport.recommendedMode;
  const reason = driftReport.signals.map((s: { message: string }) => s.message).join("; ");

  await prisma.autopilotConfig.update({
    where: { companyId },
    data: { mode: to },
  });

  await prisma.autopilotEvent.create({
    data: {
      companyId,
      documentId: "00000000-0000-0000-0000-000000000000",
      mode: to,
      decision: "drift_downgrade",
      safetyChecks: driftReport as any,
      blockedBy: "drift_detection",
      confidenceScore: 0,
      suggestedAccount: null,
      supplierName: null,
    },
  });

  await prisma.notification.create({
    data: {
      companyId,
      type: "system_alert",
      title: "Autopilot-Downgrade",
      body: "Autopilot wurde von " + from + " auf " + to + " zur\u00fcckgestuft: " + reason,
      severity: driftReport.recommendation === "emergency_stop" ? "error" : "warning",
      link: "/settings/autopilot",
    },
  });

  return { downgraded: true, from, to, reason };
}
