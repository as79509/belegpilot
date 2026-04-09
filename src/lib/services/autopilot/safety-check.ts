import { prisma } from "@/lib/db";
import { checkPeriodLock } from "@/lib/services/cockpit/period-guard";
import { analyzeSupplierPatterns } from "@/lib/services/suggestions/supplier-patterns";

export interface SafetyCheckResult {
  eligible: boolean;
  checks: Record<string, { passed: boolean; detail: string }>;
  blockedBy: string | null; // Name des ersten fehlgeschlagenen Checks
}

export interface SafetyCheckDocument {
  id: string;
  supplierNameNormalized: string | null;
  supplierId: string | null;
  grossAmount: number | null;
  currency: string | null;
  documentType: string;
  invoiceDate: Date | null;
  confidenceScore: number | null;
  decisionReasons: any;
}

export interface SafetyCheckConfig {
  minHistoryMatches: number;
  minStabilityScore: number;
  maxAmount: number | null;
  minConfidence: number;
  allowedDocTypes: string[] | null;
  allowedCurrencies: string[] | null;
  supplierAllowlist: string[] | null;
}

export async function runSafetyChecks(
  companyId: string,
  document: SafetyCheckDocument,
  config: SafetyCheckConfig
): Promise<SafetyCheckResult> {
  const checks: Record<string, { passed: boolean; detail: string }> = {};

  // 1. Supplier verifiziert?
  let supplierVerified = false;
  if (document.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: document.supplierId },
      select: { isVerified: true },
    });
    supplierVerified = supplier?.isVerified || false;
  }
  checks.supplierVerified = {
    passed: supplierVerified,
    detail: supplierVerified ? "Lieferant ist verifiziert" : "Lieferant nicht verifiziert",
  };

  // 2. Keine Eskalationen?
  const reasons = (document.decisionReasons as any) || {};
  const escalations = reasons?.escalations || [];
  checks.noEscalations = {
    passed: escalations.length === 0,
    detail:
      escalations.length === 0
        ? "Keine Eskalationen"
        : `${escalations.length} Eskalation(en) aktiv`,
  };

  // 3. Keine Validierungsfehler?
  const validationErrors = reasons?.validationErrors || [];
  checks.noValidationErrors = {
    passed: validationErrors.length === 0,
    detail:
      validationErrors.length === 0
        ? "Keine Fehler"
        : `${validationErrors.length} Validierungsfehler`,
  };

  // 4. Confidence über Schwellwert?
  const confidence = document.confidenceScore || 0;
  checks.confidenceAboveMin = {
    passed: confidence >= config.minConfidence,
    detail: `Confidence ${(confidence * 100).toFixed(0)}% (min. ${(config.minConfidence * 100).toFixed(0)}%)`,
  };

  // 5. Periode nicht gesperrt?
  let periodLocked = false;
  if (document.invoiceDate) {
    const lockResult = await checkPeriodLock(companyId, document.invoiceDate);
    periodLocked = lockResult.locked;
  }
  checks.periodNotLocked = {
    passed: !periodLocked,
    detail: periodLocked ? "Periode ist gesperrt" : "Periode offen",
  };

  // 6. Genug Historie?
  let historyCount = 0;
  if (document.supplierNameNormalized) {
    historyCount = await prisma.document.count({
      where: {
        companyId,
        supplierNameNormalized: document.supplierNameNormalized,
        status: { in: ["ready", "exported"] },
        reviewStatus: "approved",
      },
    });
  }
  checks.enoughHistory = {
    passed: historyCount >= config.minHistoryMatches,
    detail: `${historyCount} bestätigte Fälle (min. ${config.minHistoryMatches})`,
  };

  // 7. Konto-Stabilität?
  let stabilityScore = 0;
  if (document.supplierNameNormalized) {
    const pattern = await analyzeSupplierPatterns(companyId, document.supplierNameNormalized);
    stabilityScore = pattern?.accountStability || 0;
  }
  checks.stableAccount = {
    passed: stabilityScore >= config.minStabilityScore,
    detail: `Stabilität ${(stabilityScore * 100).toFixed(0)}% (min. ${(config.minStabilityScore * 100).toFixed(0)}%)`,
  };

  // 8. Betrag unter Maximum? (nur wenn maxAmount konfiguriert)
  if (config.maxAmount !== null && config.maxAmount > 0) {
    const amount = document.grossAmount || 0;
    checks.amountBelowMax = {
      passed: amount <= config.maxAmount,
      detail: `Betrag CHF ${amount.toFixed(2)} (max. CHF ${config.maxAmount.toFixed(2)})`,
    };
  }

  // 9. Erlaubter Belegtyp?
  if (config.allowedDocTypes && config.allowedDocTypes.length > 0) {
    const allowed = config.allowedDocTypes.includes(document.documentType);
    checks.allowedDocType = {
      passed: allowed,
      detail: allowed ? "Belegtyp erlaubt" : `Belegtyp "${document.documentType}" nicht erlaubt`,
    };
  }

  // 10. Erlaubte Währung?
  if (config.allowedCurrencies && config.allowedCurrencies.length > 0) {
    const allowed = config.allowedCurrencies.includes(document.currency || "");
    checks.allowedCurrency = {
      passed: allowed,
      detail: document.currency ? `Währung ${document.currency}` : "Keine Währung",
    };
  }

  // 11. Supplier auf Allowlist?
  if (config.supplierAllowlist && config.supplierAllowlist.length > 0) {
    const onList = document.supplierId
      ? config.supplierAllowlist.includes(document.supplierId)
      : false;
    checks.supplierOnAllowlist = {
      passed: onList,
      detail: onList ? "Lieferant auf Allowlist" : "Lieferant nicht auf Allowlist",
    };
  }

  // Erster fehlgeschlagener Check bestimmt blockedBy
  const failedCheck = Object.entries(checks).find(([, v]) => !v.passed);
  return {
    eligible: !failedCheck,
    checks,
    blockedBy: failedCheck ? failedCheck[0] : null,
  };
}
