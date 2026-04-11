import { prisma } from "@/lib/db";

export interface EvaluationResult {
  id: string;
  source: string;
  fieldsEvaluated: number;
  fieldsCorrect: number;
  overallCorrect: boolean;
  details: {
    account: { suggested: string | null; final: string | null; correct: boolean | null };
    category: { suggested: string | null; final: string | null; correct: boolean | null };
    costCenter: { suggested: string | null; final: string | null; correct: boolean | null };
    vatCode: { suggested: string | null; final: string | null; correct: boolean | null };
  };
}

/**
 * Erstellt eine SuggestionEvaluation beim Approve/Reject eines Dokuments.
 * Vergleicht die letzte BookingSuggestion (oder AutopilotEvent) mit den finalen Werten.
 */
export async function evaluateDocumentOutcome(
  companyId: string,
  documentId: string,
  finalValues: {
    accountCode: string | null;
    expenseCategory: string | null;
    costCenter: string | null;
    vatCode: string | null;
  }
): Promise<EvaluationResult | null> {
  // 1. Lade die letzte BookingSuggestion für dieses Dokument
  const suggestion = await prisma.bookingSuggestion.findFirst({
    where: { companyId, documentId },
    orderBy: { createdAt: "desc" },
  });

  // 2. Bestimme source
  let source = "manual";
  if (suggestion) {
    // Prüfe ob AutopilotEvent mit mode="auto_ready" existiert
    const autopilotEvent = await prisma.autopilotEvent.findFirst({
      where: { companyId, documentId, mode: "auto_ready", decision: "eligible" },
      orderBy: { createdAt: "desc" },
    });

    if (autopilotEvent) {
      source = "autopilot_auto_ready";
    } else if (suggestion.status === "accepted") {
      source = "suggestion_accept";
    } else if (suggestion.status === "modified") {
      source = "suggestion_modify";
    }
  }

  // 3. Feld-Level Vergleich
  function compareField(suggested: string | null | undefined, final: string | null) {
    if (suggested == null) return { suggested: null, final, correct: null };
    return {
      suggested,
      final,
      correct: suggested === final,
    };
  }

  const accountComparison = suggestion
    ? compareField(suggestion.suggestedAccount, finalValues.accountCode)
    : { suggested: null, final: finalValues.accountCode, correct: null };

  const categoryComparison = suggestion
    ? compareField(suggestion.suggestedCategory, finalValues.expenseCategory)
    : { suggested: null, final: finalValues.expenseCategory, correct: null };

  const costCenterComparison = suggestion
    ? compareField(suggestion.suggestedCostCenter, finalValues.costCenter)
    : { suggested: null, final: finalValues.costCenter, correct: null };

  const vatCodeComparison = suggestion
    ? compareField(suggestion.suggestedVatCode, finalValues.vatCode)
    : { suggested: null, final: finalValues.vatCode, correct: null };

  // 4. Aggregierte Metriken
  const allComparisons = [accountComparison, categoryComparison, costCenterComparison, vatCodeComparison];
  const evaluated = allComparisons.filter((c) => c.correct !== null);
  const fieldsEvaluated = evaluated.length;
  const fieldsCorrect = evaluated.filter((c) => c.correct === true).length;
  const overallCorrect = fieldsEvaluated > 0 && fieldsCorrect === fieldsEvaluated;

  // 5. Speichere SuggestionEvaluation
  const evaluation = await prisma.suggestionEvaluation.create({
    data: {
      companyId,
      documentId,
      suggestionId: suggestion?.id ?? null,
      source,
      suggestedAccount: accountComparison.suggested,
      finalAccount: accountComparison.final,
      accountCorrect: accountComparison.correct,
      suggestedCategory: categoryComparison.suggested,
      finalCategory: categoryComparison.final,
      categoryCorrect: categoryComparison.correct,
      suggestedCostCenter: costCenterComparison.suggested,
      finalCostCenter: costCenterComparison.final,
      costCenterCorrect: costCenterComparison.correct,
      suggestedVatCode: vatCodeComparison.suggested,
      finalVatCode: vatCodeComparison.final,
      vatCodeCorrect: vatCodeComparison.correct,
      fieldsEvaluated,
      fieldsCorrect,
      overallCorrect,
      confidenceScore: suggestion?.confidenceScore ?? null,
      confidenceLevel: suggestion?.confidenceLevel ?? null,
    },
  });

  return {
    id: evaluation.id,
    source,
    fieldsEvaluated,
    fieldsCorrect,
    overallCorrect,
    details: {
      account: accountComparison,
      category: categoryComparison,
      costCenter: costCenterComparison,
      vatCode: vatCodeComparison,
    },
  };
}
