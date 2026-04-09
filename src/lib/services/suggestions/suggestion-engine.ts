import { prisma } from "@/lib/db";
import { analyzeSupplierPatterns } from "./supplier-patterns";

export interface SuggestionResult {
  suggestedAccount: string | null;
  suggestedCategory: string | null;
  suggestedVatCode: string | null;
  suggestedCostCenter: string | null;
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore: number;
  reasoning: {
    sources: Array<{
      type: "history" | "rule" | "knowledge" | "supplier_default";
      detail: string;
      matchCount?: number;
    }>;
    explanation: string;
  };
  matchedDocCount: number;
  consistencyRate: number;
}

export async function generateSuggestion(
  companyId: string,
  document: {
    supplierNameNormalized: string | null;
    grossAmount: number | null;
    currency: string | null;
    vatRatesDetected: any;
    expenseCategory: string | null;
    documentType: string;
  }
): Promise<SuggestionResult | null> {
  const sources: SuggestionResult["reasoning"]["sources"] = [];

  // 1. Historische Belege vom gleichen Lieferanten (nur genehmigte/exportierte)
  let historicalDocs: any[] = [];
  if (document.supplierNameNormalized) {
    historicalDocs = await prisma.document.findMany({
      where: {
        companyId,
        supplierNameNormalized: document.supplierNameNormalized,
        status: { in: ["ready", "exported"] },
        reviewStatus: "approved",
        accountCode: { not: null },
      },
      select: {
        accountCode: true,
        expenseCategory: true,
        grossAmount: true,
        vatRatesDetected: true,
        costCenter: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  if (historicalDocs.length === 0) {
    return null;
  }

  // 2. Konto-Analyse: Was wurde am häufigsten verwendet?
  const accountCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const costCenterCounts: Record<string, number> = {};

  for (const doc of historicalDocs) {
    if (doc.accountCode) accountCounts[doc.accountCode] = (accountCounts[doc.accountCode] || 0) + 1;
    if (doc.expenseCategory) categoryCounts[doc.expenseCategory] = (categoryCounts[doc.expenseCategory] || 0) + 1;
    if (doc.costCenter) costCenterCounts[doc.costCenter] = (costCenterCounts[doc.costCenter] || 0) + 1;
  }

  const topAccount = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0];
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topCostCenter = Object.entries(costCenterCounts).sort((a, b) => b[1] - a[1])[0];

  const total = historicalDocs.length;
  const accountConsistency = topAccount ? topAccount[1] / total : 0;

  // 3. Historische Quelle dokumentieren
  if (topAccount) {
    sources.push({
      type: "history",
      detail: `Lieferant ${document.supplierNameNormalized} wurde in ${topAccount[1]} von ${total} Fällen auf Konto ${topAccount[0]} gebucht`,
      matchCount: topAccount[1],
    });
  }

  // 4. Regeln prüfen
  const rules = await prisma.rule.findMany({
    where: { companyId, isActive: true },
  });

  for (const rule of rules) {
    const conditions = rule.conditions as any[];
    const actions = rule.actions as any[];
    if (!Array.isArray(conditions) || !Array.isArray(actions)) continue;
    const matches = conditions.some((c: any) => {
      if (c.field === "expenseCategory" && document.expenseCategory) {
        if (c.operator === "equals") return document.expenseCategory === c.value;
        if (c.operator === "contains") return document.expenseCategory.includes(c.value);
      }
      return false;
    });
    if (matches) {
      const accountAction = actions.find((a: any) => a.type === "set_account_code");
      if (accountAction) {
        sources.push({ type: "rule", detail: `Regel "${rule.name}" setzt Konto ${accountAction.value}` });
      }
    }
  }

  // 5. Knowledge Items prüfen
  const knowledge = await prisma.knowledgeItem.findMany({
    where: {
      companyId,
      isActive: true,
      usableByAi: true,
      OR: [
        { relatedSupplier: document.supplierNameNormalized || undefined },
        { relatedAccount: topAccount?.[0] || undefined },
      ],
    },
    take: 3,
  });

  for (const ki of knowledge) {
    sources.push({ type: "knowledge", detail: `Wissenseintrag "${ki.title}" berücksichtigt` });
  }

  // 6. Lieferanten-Default prüfen
  if (document.supplierNameNormalized) {
    const supplier = await prisma.supplier.findFirst({
      where: { companyId, nameNormalized: document.supplierNameNormalized },
      select: { defaultAccountCode: true, defaultCategory: true, isVerified: true },
    });
    if (supplier?.defaultAccountCode) {
      sources.push({ type: "supplier_default", detail: `Lieferanten-Standard: Konto ${supplier.defaultAccountCode}` });
    }
  }

  // 7. MwSt-Code ableiten
  const vatRates = document.vatRatesDetected as any[] || [];
  let suggestedVatCode: string | null = null;
  if (Array.isArray(vatRates) && vatRates.length === 1) {
    const rate = vatRates[0].rate;
    if (rate === 8.1) suggestedVatCode = "8.1";
    else if (rate === 2.6) suggestedVatCode = "2.6";
    else if (rate === 0) suggestedVatCode = "0.0";
    else suggestedVatCode = String(rate);
  }

  // 8. Confidence berechnen
  let score = 0;
  if (accountConsistency >= 0.9 && total >= 5) score = 0.95;
  else if (accountConsistency >= 0.8 && total >= 3) score = 0.85;
  else if (accountConsistency >= 0.6 && total >= 2) score = 0.70;
  else if (total >= 1) score = 0.50;

  // Bonus für Regel-Match
  if (sources.some(s => s.type === "rule")) score = Math.min(score + 0.05, 1.0);
  // Bonus für Knowledge
  if (sources.some(s => s.type === "knowledge")) score = Math.min(score + 0.03, 1.0);
  // Bonus für Lieferanten-Default
  if (sources.some(s => s.type === "supplier_default")) score = Math.min(score + 0.05, 1.0);

  // 10/11. Betrags- und MwSt-Anomalien erkennen
  if (document.supplierNameNormalized) {
    const pattern = await analyzeSupplierPatterns(companyId, document.supplierNameNormalized);
    if (pattern && pattern.isAmountStable && document.grossAmount && pattern.typicalAmount) {
      const deviation = Math.abs(document.grossAmount - pattern.typicalAmount);
      const threshold = pattern.typicalAmount * 0.3; // 30% Toleranz
      if (deviation > threshold) {
        sources.push({
          type: "history",
          detail: `Betrag CHF ${document.grossAmount} weicht vom typischen Betrag CHF ${pattern.typicalAmount.toFixed(2)} ab (±30%)`,
        });
        score = Math.max(score - 0.1, 0.3);
      }
    }
    if (pattern && pattern.vatStability >= 0.8 && document.vatRatesDetected) {
      const docVat = (document.vatRatesDetected as any[])?.[0]?.rate;
      if (typeof docVat === "number" && pattern.dominantVatRate !== null && docVat !== pattern.dominantVatRate) {
        sources.push({
          type: "history",
          detail: `MwSt ${docVat}% weicht vom üblichen Satz ${pattern.dominantVatRate}% ab`,
        });
        score = Math.max(score - 0.1, 0.3);
      }
    }
  }

  const level = score >= 0.85 ? "high" : score >= 0.65 ? "medium" : "low";

  // 9. Erklärung zusammenbauen
  const explanation = sources.map(s => s.detail).join(". ") + ".";

  return {
    suggestedAccount: topAccount?.[0] || null,
    suggestedCategory: topCategory?.[0] || null,
    suggestedVatCode,
    suggestedCostCenter: topCostCenter?.[0] || null,
    confidenceLevel: level,
    confidenceScore: score,
    reasoning: { sources, explanation },
    matchedDocCount: total,
    consistencyRate: accountConsistency,
  };
}
