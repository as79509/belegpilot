import { prisma } from "@/lib/db";

export type DocClass = "learning_base" | "recurring" | "contractual" | "critical" | "exception" | "uncertain";

export interface ClassifiedDocument {
  documentId: string;
  supplierName: string | null;
  amount: number | null;
  date: string | null;
  classification: DocClass;
  classificationReason: string;
  confidence: "high" | "medium" | "low";
  suggestedActions: string[];
}

export interface KnownUnknownEntry {
  area: string;
  description: string;
  criticality: "low" | "medium" | "high";
  suggestedAction: string;
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
  newKnownUnknowns: KnownUnknownEntry[];
}

const EXPECTED_CATEGORIES = [
  { key: "supplier_invoice", label: "Lieferantenrechnungen", patterns: ["invoice", "credit_note"] },
  { key: "rent", label: "Miete/Pacht", categoryPatterns: ["miete", "pacht"] },
  { key: "insurance", label: "Versicherung", categoryPatterns: ["versicher"] },
  { key: "telecom", label: "Telekommunikation", supplierPatterns: ["swisscom", "sunrise", "salt", "telekom"], categoryPatterns: ["telekom", "telefon", "internet"] },
  { key: "leasing", label: "Leasing", categoryPatterns: ["leas"] },
];

export async function classifyBootstrapDocuments(companyId: string): Promise<BootstrapResult> {
  const docs = await prisma.document.findMany({
    where: { companyId, status: { notIn: ["rejected", "failed"] } },
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
      invoiceDate: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const emptyByClass: Record<DocClass, number> = { learning_base: 0, recurring: 0, contractual: 0, critical: 0, exception: 0, uncertain: 0 };

  if (docs.length === 0) {
    return {
      documents: [],
      summary: { total: 0, byClass: emptyByClass, uniqueSuppliers: 0, recurringCandidates: 0, missingTypes: EXPECTED_CATEGORIES.map((c) => c.label) },
      recommendations: ["Laden Sie Ihre ersten Belege hoch, damit das System Muster erkennen kann."],
      newKnownUnknowns: [],
    };
  }

  // Group by supplier
  const supplierGroups = new Map<string, Array<typeof docs[0]>>();
  for (const doc of docs) {
    const key = doc.supplierNameNormalized || doc.supplierNameRaw || "unknown";
    if (!supplierGroups.has(key)) supplierGroups.set(key, []);
    supplierGroups.get(key)!.push(doc);
  }

  const classified: ClassifiedDocument[] = [];

  for (const doc of docs) {
    const supplierKey = doc.supplierNameNormalized || doc.supplierNameRaw || null;
    const amount = doc.grossAmount ? Number(doc.grossAmount) : null;
    const supplierDocs = supplierKey ? (supplierGroups.get(supplierKey) || []) : [];
    const category = (doc.expenseCategory || "").toLowerCase();
    const supplierLower = (supplierKey || "").toLowerCase();
    const actions: string[] = [];

    let classification: DocClass = "uncertain";
    let reason = "";
    let confidence: "high" | "medium" | "low" = "low";

    // 1. Recurring: same supplier 3+ times with similar amounts (±20%)
    if (supplierDocs.length >= 3 && amount) {
      const amounts = supplierDocs.map((d) => (d.grossAmount ? Number(d.grossAmount) : null)).filter((a): a is number => a !== null);
      if (amounts.length >= 3) {
        const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const withinRange = amounts.filter((a) => Math.abs(a - avg) / avg <= 0.2).length;
        if (withinRange >= Math.floor(amounts.length * 0.6)) {
          classification = "recurring";
          reason = `Lieferant ${supplierKey} erscheint ${supplierDocs.length}x mit \u00e4hnlichem Betrag`;
          confidence = "high";
          actions.push("expected_document", "supplier_pattern");
        }
      }
    }

    // 2. Contractual
    if (classification === "uncertain") {
      const contractualKeywords = ["miete", "pacht", "leasing", "versicherung", "police"];
      if (contractualKeywords.some((k) => category.includes(k) || supplierLower.includes(k))) {
        classification = "contractual";
        reason = `Vertraglicher Beleg (${doc.expenseCategory || doc.documentType})`;
        confidence = "medium";
        actions.push("expected_document", "contract_object");
      }
    }

    // 3. Critical: amount > 5000
    if (classification === "uncertain" && amount && amount > 5000) {
      classification = "critical";
      reason = `Hoher Betrag (${amount.toFixed(2)} CHF)`;
      confidence = "medium";
    }

    // 4. Exception: unusual VAT or missing account despite supplier
    if (classification === "uncertain") {
      const vatRates = doc.vatRatesDetected as number[] | null;
      const unusualVat = vatRates && vatRates.some((r) => ![0, 2.6, 3.8, 8.1].includes(r));
      if (unusualVat) {
        classification = "exception";
        reason = "Ungew\u00f6hnlicher MwSt-Satz erkannt";
        confidence = "low";
      } else if (!doc.accountCode && doc.supplierId) {
        classification = "exception";
        reason = "Kein Konto trotz bekanntem Lieferanten";
        confidence = "low";
      }
    }

    // 5. Learning base: decent confidence
    if (classification === "uncertain" && doc.confidenceScore && doc.confidenceScore >= 0.5) {
      classification = "learning_base";
      reason = "Standardbeleg mit ausreichender Konfidenz";
      confidence = doc.confidenceScore >= 0.7 ? "high" : "medium";
    }

    // Still uncertain
    if (classification === "uncertain") {
      reason = "Zu wenig Daten f\u00fcr sichere Klassifikation";
    }

    // Suggested actions
    if (supplierDocs.length >= 3) actions.push("supplier_pattern");
    if (doc.accountCode && supplierDocs.length >= 2 && !actions.includes("rule_candidate")) actions.push("rule_candidate");

    classified.push({
      documentId: doc.id,
      supplierName: supplierKey,
      amount,
      date: doc.invoiceDate ? doc.invoiceDate.toISOString().split("T")[0] : null,
      classification,
      classificationReason: reason,
      confidence,
      suggestedActions: [...new Set(actions)],
    });
  }

  // Summary
  const byClass = { ...emptyByClass };
  for (const c of classified) byClass[c.classification]++;
  const uniqueSuppliers = new Set(classified.map((c) => c.supplierName).filter(Boolean)).size;

  // Missing types detection
  const allCategory = docs.map((d) => (d.expenseCategory || "").toLowerCase()).join(" ");
  const allSupplier = docs.map((d) => `${(d.supplierNameNormalized || "").toLowerCase()} ${(d.supplierNameRaw || "").toLowerCase()}`).join(" ");
  const allTypes = docs.map((d) => d.documentType).join(" ");

  const missingTypes: string[] = [];
  for (const cat of EXPECTED_CATEGORIES) {
    let found = false;
    if ("patterns" in cat && cat.patterns) found = cat.patterns.some((p) => allTypes.includes(p));
    if (!found && "categoryPatterns" in cat && cat.categoryPatterns) found = (cat.categoryPatterns as string[]).some((p) => allCategory.includes(p));
    if (!found && "supplierPatterns" in cat && cat.supplierPatterns) found = (cat.supplierPatterns as string[]).some((p) => allSupplier.includes(p));
    if (!found) missingTypes.push(cat.label);
  }

  // Recommendations
  const recommendations: string[] = [];
  if (missingTypes.length > 0) recommendations.push(`Es fehlen noch: ${missingTypes.join(", ")}`);
  if (docs.length < 10) recommendations.push("Laden Sie mindestens 10 Belege hoch f\u00fcr bessere Mustererkennung.");
  if (uniqueSuppliers < 3) recommendations.push("Belege von verschiedenen Lieferanten helfen bei der Kontierungsautomatik.");

  // KnownUnknowns for missing types
  const newKnownUnknowns: KnownUnknownEntry[] = [];
  for (const type of missingTypes) {
    newKnownUnknowns.push({
      area: "belege",
      description: `Keine ${type} in den hochgeladenen Belegen gefunden`,
      criticality: "medium",
      suggestedAction: `Laden Sie typische ${type}-Belege hoch`,
    });
  }
  // KnownUnknown if recurring found but no ExpectedDocument
  if (byClass.recurring > 0) {
    const expectedDocCount = await prisma.expectedDocument.count({ where: { companyId } });
    if (expectedDocCount === 0) {
      newKnownUnknowns.push({
        area: "erwartete_belege",
        description: "Wiederkehrende Belege erkannt, aber noch keine erwarteten Dokumente definiert",
        criticality: "medium",
        suggestedAction: "Legen Sie erwartete Dokumente an basierend auf den erkannten Mustern",
      });
    }
  }

  return {
    documents: classified,
    summary: { total: classified.length, byClass, uniqueSuppliers, recurringCandidates: byClass.recurring, missingTypes },
    recommendations,
    newKnownUnknowns,
  };
}
