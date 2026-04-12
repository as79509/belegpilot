import { prisma } from "@/lib/db";

export type DocClass = "learning_base" | "recurring" | "contractual" | "critical" | "exception" | "uncertain";

export interface ClassifiedDocument {
  documentId: string;
  supplierName: string | null;
  amount: number | null;
  classification: DocClass;
  classificationReason: string;
  confidence: "high" | "medium" | "low";
  suggestedActions: string[];
}

export interface BootstrapResult {
  documents: ClassifiedDocument[];
  summary: {
    total: number;
    byClass: Record<DocClass, number>;
    uniqueSuppliers: number;
    recurringCandidates: number;
    missingTypes: string[];
  };
  recommendations: string[];
}

const EXPECTED_CATEGORIES = [
  { key: "supplier_invoice", label: "Lieferantenrechnung", patterns: ["invoice", "credit_note"] },
  { key: "rent", label: "Miete/Pacht", patterns: ["Miete", "Pacht", "Geschäftsmiete"] },
  { key: "insurance", label: "Versicherung", patterns: ["Versicherung", "Police", "Haftpflicht"] },
  { key: "leasing", label: "Leasing", patterns: ["Leasing", "Finanzierung"] },
  { key: "salary", label: "Löhne/Gehälter", patterns: ["Lohn", "Gehalt", "Sozialversicherung", "AHV"] },
  { key: "telecom", label: "Telekommunikation", patterns: ["Telekom", "Swisscom", "Sunrise", "Salt", "Internet", "Telefon"] },
];

export async function classifyBootstrapDocuments(companyId: string): Promise<BootstrapResult> {
  const docs = await prisma.document.findMany({
    where: {
      companyId,
      status: { notIn: ["rejected", "failed"] },
    },
    select: {
      id: true,
      supplierNameNormalized: true,
      supplierNameRaw: true,
      grossAmount: true,
      documentType: true,
      expenseCategory: true,
      accountCode: true,
      confidenceScore: true,
      vatRatesDetected: true,
      supplierId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (docs.length === 0) {
    return {
      documents: [],
      summary: {
        total: 0,
        byClass: { learning_base: 0, recurring: 0, contractual: 0, critical: 0, exception: 0, uncertain: 0 },
        uniqueSuppliers: 0,
        recurringCandidates: 0,
        missingTypes: EXPECTED_CATEGORIES.map((c) => c.label),
      },
      recommendations: ["Laden Sie Ihre ersten Belege hoch, damit das System Muster erkennen kann."],
    };
  }

  // Group by supplier for recurring detection
  const supplierGroups = new Map<string, Array<typeof docs[0]>>();
  for (const doc of docs) {
    const key = doc.supplierNameNormalized || doc.supplierNameRaw || "unknown";
    if (!supplierGroups.has(key)) supplierGroups.set(key, []);
    supplierGroups.get(key)!.push(doc);
  }

  // Classify each document
  const classified: ClassifiedDocument[] = [];

  for (const doc of docs) {
    const supplierKey = doc.supplierNameNormalized || doc.supplierNameRaw || null;
    const amount = doc.grossAmount ? Number(doc.grossAmount) : null;
    const supplierDocs = supplierKey ? (supplierGroups.get(supplierKey) || []) : [];
    const category = doc.expenseCategory?.toLowerCase() || "";
    const actions: string[] = [];

    let classification: DocClass = "uncertain";
    let reason = "";
    let confidence: "high" | "medium" | "low" = "low";

    // Check recurring: same supplier 3+ times with similar amounts
    if (supplierDocs.length >= 3 && amount) {
      const amounts = supplierDocs
        .map((d) => (d.grossAmount ? Number(d.grossAmount) : null))
        .filter((a): a is number => a !== null);
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const withinRange = amounts.filter((a) => Math.abs(a - avg) / avg <= 0.2).length;
      if (withinRange >= Math.floor(amounts.length * 0.6)) {
        classification = "recurring";
        reason = `Lieferant ${supplierKey} erscheint ${supplierDocs.length}x mit ähnlichem Betrag`;
        confidence = "high";
        actions.push("expected_document", "supplier_pattern");
      }
    }

    // Check contractual
    if (classification === "uncertain") {
      const contractualKeywords = ["miete", "pacht", "leasing", "versicherung", "police"];
      if (contractualKeywords.some((k) => category.includes(k) || (supplierKey || "").toLowerCase().includes(k))) {
        classification = "contractual";
        reason = `Vertraglicher Beleg (${doc.expenseCategory || doc.documentType})`;
        confidence = "medium";
        actions.push("expected_document");
      }
    }

    // Check critical
    if (classification === "uncertain") {
      if (amount && amount > 5000) {
        classification = "critical";
        reason = `Hoher Betrag (${amount.toFixed(2)} CHF)`;
        confidence = "medium";
      }
    }

    // Check exception
    if (classification === "uncertain") {
      const vatRates = doc.vatRatesDetected as number[] | null;
      const unusualVat = vatRates && vatRates.some((r) => ![0, 2.6, 3.8, 8.1].includes(r));
      if (unusualVat) {
        classification = "exception";
        reason = "Ungewöhnlicher MwSt-Satz erkannt";
        confidence = "low";
      } else if (!doc.accountCode && doc.supplierId) {
        classification = "exception";
        reason = "Kein Konto trotz bekanntem Lieferanten";
        confidence = "low";
      }
    }

    // Learning base: good confidence, not yet classified
    if (classification === "uncertain" && doc.confidenceScore && doc.confidenceScore >= 0.5) {
      classification = "learning_base";
      reason = "Standardbeleg mit ausreichender Konfidenz";
      confidence = doc.confidenceScore >= 0.7 ? "high" : "medium";
      if (supplierDocs.length >= 3) actions.push("supplier_pattern");
      if (doc.accountCode && supplierDocs.length >= 2) actions.push("rule_candidate");
    }

    // Still uncertain
    if (classification === "uncertain") {
      reason = "Zu wenig Daten für sichere Klassifikation";
    }

    classified.push({
      documentId: doc.id,
      supplierName: supplierKey,
      amount,
      classification,
      classificationReason: reason,
      confidence,
      suggestedActions: actions,
    });
  }

  // Summary
  const byClass: Record<DocClass, number> = { learning_base: 0, recurring: 0, contractual: 0, critical: 0, exception: 0, uncertain: 0 };
  for (const c of classified) byClass[c.classification]++;

  const uniqueSuppliers = new Set(classified.map((c) => c.supplierName).filter(Boolean)).size;
  const recurringCandidates = byClass.recurring;

  // Check which categories are missing
  const allText = docs.map((d) => `${d.expenseCategory || ""} ${d.supplierNameNormalized || ""} ${d.supplierNameRaw || ""} ${d.documentType || ""}`).join(" ").toLowerCase();
  const missingTypes: string[] = [];
  for (const cat of EXPECTED_CATEGORIES) {
    const found = cat.patterns.some((p) => allText.includes(p.toLowerCase()));
    if (!found) missingTypes.push(cat.label);
  }

  // Recommendations
  const recommendations: string[] = [];
  if (missingTypes.length > 0) {
    recommendations.push(`Es fehlen noch: ${missingTypes.join(", ")}`);
  }
  if (docs.length < 10) {
    recommendations.push("Laden Sie mindestens 10 Belege hoch für bessere Mustererkennung.");
  }
  if (uniqueSuppliers < 3) {
    recommendations.push("Belege von verschiedenen Lieferanten helfen bei der Kontierungsautomatik.");
  }

  return {
    documents: classified,
    summary: {
      total: classified.length,
      byClass,
      uniqueSuppliers,
      recurringCandidates,
      missingTypes,
    },
    recommendations,
  };
}
