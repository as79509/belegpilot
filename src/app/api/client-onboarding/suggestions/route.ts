import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import type { OnboardingInsight } from "../questions/route";

/**
 * AI Suggestions API for Client Onboarding
 * 
 * Generates suggestions based on:
 * - Form data (company info, legal form, industry)
 * - Uploaded documents and extracted data
 * - Chat-derived business insights
 * 
 * POST - Generate suggestions
 * PATCH - Update suggestion status (accept/reject)
 */

export interface AISuggestion {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  confidenceLevel: "high" | "needs_review" | "manual";
  reason: string;
  source: "form" | "document" | "chat" | "rule";
  field?: string;
  value?: string;
  status: "pending" | "accepted" | "rejected";
}

// Confidence thresholds
const HIGH_CONFIDENCE = 0.85;
const NEEDS_REVIEW = 0.65;

function getConfidenceLevel(confidence: number): "high" | "needs_review" | "manual" {
  if (confidence >= HIGH_CONFIDENCE) return "high";
  if (confidence >= NEEDS_REVIEW) return "needs_review";
  return "manual";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json({ error: "draftId erforderlich" }, { status: 400 });
    }

    // Load the draft with all data
    const draft = await prisma.onboardingDraft.findFirst({
      where: { id: draftId, userId: session.user.id },
    });

    if (!draft) {
      return NextResponse.json({ error: "Entwurf nicht gefunden" }, { status: 404 });
    }

    const draftData = draft.data as Record<string, unknown>;
    
    // Generate suggestions based on all available data
    const suggestions = await generateDataDrivenSuggestions({
      formData: {
        name: draftData.name as string,
        legalForm: draftData.legalForm as string,
        industry: draftData.industry as string,
        vatLiable: draftData.vatLiable as boolean,
        vatMethod: draftData.vatMethod as string,
      },
      businessInsights: (draftData.businessInsights as OnboardingInsight[]) || [],
      uploadedFiles: (draftData.uploadedFiles as Array<{ type: string; name: string }>) || [],
      chatMessages: (draftData.chatMessages as Array<{ role: string; content: string }>) || [],
    });

    // Save suggestions to draft
    await prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        data: {
          ...draftData,
          aiSuggestions: suggestions,
          suggestionsGeneratedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      suggestions,
      generatedAt: new Date().toISOString(),
      summary: {
        total: suggestions.length,
        highConfidence: suggestions.filter(s => s.confidenceLevel === "high").length,
        needsReview: suggestions.filter(s => s.confidenceLevel === "needs_review").length,
        manual: suggestions.filter(s => s.confidenceLevel === "manual").length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[Suggestions] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { draftId, suggestionId, status } = body;

    if (!draftId || !suggestionId || !status) {
      return NextResponse.json({ error: "draftId, suggestionId und status erforderlich" }, { status: 400 });
    }

    if (!["accepted", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    const draft = await prisma.onboardingDraft.findFirst({
      where: { id: draftId, userId: session.user.id },
    });

    if (!draft) {
      return NextResponse.json({ error: "Entwurf nicht gefunden" }, { status: 404 });
    }

    const draftData = draft.data as Record<string, unknown>;
    const suggestions = (draftData.aiSuggestions as AISuggestion[]) || [];
    
    const updatedSuggestions = suggestions.map((s) =>
      s.id === suggestionId ? { ...s, status } : s
    );

    await prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        data: {
          ...draftData,
          aiSuggestions: updatedSuggestions,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[Suggestions] PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface SuggestionInput {
  formData: {
    name?: string;
    legalForm?: string;
    industry?: string;
    vatLiable?: boolean;
    vatMethod?: string;
  };
  businessInsights: OnboardingInsight[];
  uploadedFiles: Array<{ type: string; name: string }>;
  chatMessages: Array<{ role: string; content: string }>;
}

async function generateDataDrivenSuggestions(input: SuggestionInput): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [];
  const { formData, businessInsights, uploadedFiles } = input;
  
  const industry = (formData.industry || "").toLowerCase();
  const legalForm = (formData.legalForm || "").toLowerCase();
  const vatMethod = formData.vatMethod || "effektiv";
  const vatLiable = formData.vatLiable !== false;

  // Group insights by type for easier access
  const insightsByType: Record<string, OnboardingInsight[]> = {};
  for (const insight of businessInsights) {
    if (!insightsByType[insight.type]) {
      insightsByType[insight.type] = [];
    }
    insightsByType[insight.type].push(insight);
  }

  // === 1. CHART OF ACCOUNTS (based on form + insights) ===
  const chartSuggestion = generateChartSuggestion(legalForm, industry, insightsByType);
  suggestions.push(chartSuggestion);

  // === 2. COST CENTERS (based on insights) ===
  const costCenterSuggestion = generateCostCenterSuggestion(industry, insightsByType);
  suggestions.push(costCenterSuggestion);

  // === 3. DOCUMENT CATEGORIES (based on uploaded files + industry) ===
  const docCategorySuggestion = generateDocCategorySuggestion(industry, uploadedFiles);
  suggestions.push(docCategorySuggestion);

  // === 4. VAT CONFIGURATION ===
  if (vatLiable) {
    suggestions.push(generateVatSuggestion(vatMethod, industry));
  }

  // === 5. AI AUTONOMY (based on complexity from insights) ===
  suggestions.push(generateAutonomySuggestion(industry, insightsByType, uploadedFiles.length));

  // === 6. INSIGHT-DERIVED SUGGESTIONS ===
  const insightSuggestions = generateInsightBasedSuggestions(insightsByType, industry);
  suggestions.push(...insightSuggestions);

  // === 7. DOCUMENT-DERIVED SUGGESTIONS ===
  if (uploadedFiles.length > 0) {
    const docSuggestions = generateDocumentBasedSuggestions(uploadedFiles);
    suggestions.push(...docSuggestions);
  }

  // === 8. INDUSTRY-SPECIFIC SUGGESTIONS ===
  const industrySuggestions = generateIndustrySpecificSuggestions(industry, insightsByType);
  suggestions.push(...industrySuggestions);

  return suggestions;
}

function generateChartSuggestion(
  legalForm: string,
  industry: string,
  insights: Record<string, OnboardingInsight[]>
): AISuggestion {
  // Base confidence from form data
  let confidence = 0.7;
  let suggestion = "KMU-Kontenrahmen";
  let value = "kmu";
  let reason = "Standard für Schweizer KMU.";
  let source: "form" | "chat" | "document" | "rule" = "form";

  // Increase confidence if we have supporting insights
  const revenueInsights = insights["revenue"] || [];
  const specialInsights = insights["special"] || [];

  if (legalForm === "einzelfirma") {
    suggestion = "KMU-Kontenrahmen (vereinfacht)";
    value = "kmu_simplified";
    confidence = 0.88;
    reason = "Vereinfachter Kontenrahmen optimal für Einzelfirmen.";
  }

  if (industry.includes("gastro") || industry.includes("hotel")) {
    suggestion = "Käfer-Kontenrahmen für Hotellerie & Gastronomie";
    value = "kaefer_gastro";
    confidence = 0.85;
    reason = "Branchenspezifischer Kontenrahmen mit F&B-Konten.";
    
    // Boost if we have revenue insights confirming gastro
    if (revenueInsights.some(i => 
      i.content.toLowerCase().includes("restaurant") ||
      i.content.toLowerCase().includes("bar") ||
      i.content.toLowerCase().includes("küche")
    )) {
      confidence = 0.92;
      source = "chat";
      reason += " Bestätigt durch Geschäftsinformationen.";
    }
  }

  // Check for complex business models
  if (specialInsights.some(i => i.confidence > 0.8)) {
    confidence = Math.max(confidence - 0.1, 0.6); // Reduce confidence for complex cases
  }

  return {
    id: randomUUID(),
    category: "Kontenrahmen",
    suggestion,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    reason,
    source,
    field: "chartOfAccounts",
    value,
    status: "pending",
  };
}

function generateCostCenterSuggestion(
  industry: string,
  insights: Record<string, OnboardingInsight[]>
): AISuggestion {
  const locationInsights = insights["location"] || [];
  const processInsights = insights["process"] || [];
  
  let suggestion = "Einfache Kostenstellenstruktur";
  let value = "simple";
  let confidence = 0.85;
  let reason = "Für kleinere Unternehmen ist eine einfache Struktur ausreichend.";
  let source: "form" | "chat" | "document" | "rule" = "rule";

  // Check for multiple locations
  if (locationInsights.length > 0) {
    const hasMultipleLocations = locationInsights.some(i => 
      i.content.toLowerCase().includes("standort") ||
      i.content.toLowerCase().includes("filiale") ||
      i.content.toLowerCase().includes("niederlassung")
    );
    
    if (hasMultipleLocations) {
      suggestion = "Kostenstellen nach Standorten/Filialen";
      value = "by_location";
      confidence = 0.82;
      reason = `Mehrere Standorte aus Gespräch erkannt.`;
      source = "chat";
    }
  }

  // Gastro-specific departments
  if (industry.includes("gastro") || industry.includes("hotel")) {
    suggestion = "Kostenstellen nach Abteilungen (Küche, Service, Bar)";
    value = "by_department_gastro";
    confidence = 0.84;
    reason = "Typische Abteilungsstruktur für Gastrobetriebe.";
    source = "form";
    
    // Boost if confirmed in chat
    if (processInsights.some(i => i.content.toLowerCase().includes("abteilung"))) {
      confidence = 0.91;
      source = "chat";
    }
  }

  return {
    id: randomUUID(),
    category: "Kostenstellen",
    suggestion,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    reason,
    source,
    field: "costCenters",
    value,
    status: "pending",
  };
}

function generateDocCategorySuggestion(
  industry: string,
  uploadedFiles: Array<{ type: string; name: string }>
): AISuggestion {
  let confidence = 0.82;
  let suggestion = "Standard-Belegkategorien";
  let value = "standard";
  let source: "form" | "chat" | "document" | "rule" = "rule";

  // Analyze uploaded file names for patterns
  const fileNames = uploadedFiles.map(f => f.name.toLowerCase()).join(" ");
  
  if (fileNames.includes("rechnung") || fileNames.includes("invoice")) {
    value = "standard_with_invoices";
    suggestion = "Standard-Kategorien mit erweiterter Rechnungsverwaltung";
    confidence = 0.87;
    source = "document";
  }

  if (industry) {
    value = `standard_${industry.split(" ")[0]}`;
    suggestion = `Kategorien angepasst für ${industry}`;
    confidence = 0.85;
    source = "form";
  }

  return {
    id: randomUUID(),
    category: "Belegkategorien",
    suggestion,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    reason: uploadedFiles.length > 0 
      ? `Basierend auf ${uploadedFiles.length} hochgeladenen Dokumenten.`
      : "Standard-Empfehlung basierend auf Branche.",
    source,
    field: "documentCategories",
    value,
    status: "pending",
  };
}

function generateVatSuggestion(vatMethod: string, industry: string): AISuggestion {
  const isEffektiv = vatMethod === "effektiv";
  
  return {
    id: randomUUID(),
    category: "MwSt-Konfiguration",
    suggestion: isEffektiv 
      ? "Effektive MwSt mit Vorsteuerabzug (7.7%, 2.5%, 3.7%)"
      : "Saldosteuersatz-Konten mit automatischer Berechnung",
    confidence: 0.92,
    confidenceLevel: "high",
    reason: `${isEffektiv ? "Effektive Methode" : "Saldosteuersatz"} wie im Formular angegeben.`,
    source: "form",
    field: "vatConfig",
    value: vatMethod,
    status: "pending",
  };
}

function generateAutonomySuggestion(
  industry: string,
  insights: Record<string, OnboardingInsight[]>,
  documentCount: number
): AISuggestion {
  const specialInsights = insights["special"] || [];
  const hasComplexity = specialInsights.some(i => i.confidence > 0.7);
  
  let threshold = "0.70";
  let suggestion = "Ausgewogene KI-Einstellung (>70% Konfidenz)";
  let confidence = 0.78;
  let reason = "Standard-Empfehlung für die meisten Unternehmen.";

  // Conservative for complex industries
  if (industry.includes("bau") || industry.includes("immobilien") || hasComplexity) {
    threshold = "0.80";
    suggestion = "Konservative KI-Einstellung (>80% Konfidenz)";
    confidence = 0.82;
    reason = "Höhere Prüfschwelle für komplexere Geschäftsfälle.";
  }

  // More autonomy for simple businesses with many documents
  if ((industry.includes("beratung") || industry.includes("it")) && documentCount > 5) {
    threshold = "0.65";
    suggestion = "Moderate KI-Autonomie (>65% Konfidenz)";
    confidence = 0.85;
    reason = "Geeignet für standardisierte Geschäftsprozesse.";
  }

  return {
    id: randomUUID(),
    category: "KI-Autonomie",
    suggestion,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    reason,
    source: "rule",
    field: "aiConfidenceThreshold",
    value: threshold,
    status: "pending",
  };
}

function generateInsightBasedSuggestions(
  insights: Record<string, OnboardingInsight[]>,
  industry: string
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // Supplier insights → Payment terms suggestion
  const supplierInsights = insights["supplier"] || [];
  if (supplierInsights.length > 0) {
    const avgConfidence = supplierInsights.reduce((a, b) => a + b.confidence, 0) / supplierInsights.length;
    suggestions.push({
      id: randomUUID(),
      category: "Lieferantenmanagement",
      suggestion: "Automatische Kreditorenzuordnung basierend auf erkannten Lieferanten",
      confidence: avgConfidence * 0.9,
      confidenceLevel: getConfidenceLevel(avgConfidence * 0.9),
      reason: `${supplierInsights.length} Lieferant(en) aus Gespräch erkannt.`,
      source: "chat",
      field: "supplierMatching",
      value: "auto",
      status: "pending",
    });
  }

  // Employee insights → Payroll suggestion
  const employeeInsights = insights["employee"] || [];
  if (employeeInsights.length > 0) {
    suggestions.push({
      id: randomUUID(),
      category: "Lohnbuchhaltung",
      suggestion: "Lohnkonten und Sozialversicherungsabzüge einrichten",
      confidence: 0.88,
      confidenceLevel: "high",
      reason: "Mitarbeiterinformationen aus Gespräch erkannt.",
      source: "chat",
      field: "payrollAccounts",
      value: "enable",
      status: "pending",
    });
  }

  // Revenue insights → Invoice templates
  const revenueInsights = insights["revenue"] || [];
  if (revenueInsights.some(i => i.content.toLowerCase().includes("dienstleistung"))) {
    suggestions.push({
      id: randomUUID(),
      category: "Rechnungsstellung",
      suggestion: "Rechnungsvorlage für Dienstleistungen",
      confidence: 0.82,
      confidenceLevel: "needs_review",
      reason: "Dienstleistungsgeschäft aus Gespräch erkannt.",
      source: "chat",
      field: "invoiceTemplate",
      value: "service",
      status: "pending",
    });
  }

  return suggestions;
}

function generateDocumentBasedSuggestions(
  uploadedFiles: Array<{ type: string; name: string }>
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  
  // Analyze document patterns
  const hasManyInvoices = uploadedFiles.filter(f => 
    f.name.toLowerCase().includes("rechnung") ||
    f.type === "application/pdf"
  ).length > 3;

  if (hasManyInvoices) {
    suggestions.push({
      id: randomUUID(),
      category: "Dokumentenverarbeitung",
      suggestion: "Automatische Rechnungserkennung aktivieren",
      confidence: 0.86,
      confidenceLevel: "high",
      reason: `${uploadedFiles.length} Dokumente hochgeladen - automatische Verarbeitung empfohlen.`,
      source: "document",
      field: "autoInvoiceProcessing",
      value: "enable",
      status: "pending",
    });
  }

  return suggestions;
}

// Industry-specific suggestion generator
function generateIndustrySpecificSuggestions(
  industry: string,
  insights: Record<string, OnboardingInsight[]>
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // === GASTRONOMIE ===
  if (industry.includes("gastro") || industry.includes("hotel") || industry.includes("restaurant")) {
    // Cash register integration
    const processInsights = insights["process"] || [];
    const hasCashRegister = processInsights.some(i => 
      i.content.toLowerCase().includes("kasse") ||
      i.content.toLowerCase().includes("pos")
    );
    
    suggestions.push({
      id: randomUUID(),
      category: "Kassensystem",
      suggestion: hasCashRegister 
        ? "Kassensystem-Schnittstelle für automatischen Tagesabschluss"
        : "Manuelle Tagesabschluss-Erfassung einrichten",
      confidence: hasCashRegister ? 0.88 : 0.75,
      confidenceLevel: hasCashRegister ? "high" : "needs_review",
      reason: hasCashRegister 
        ? "Kassensystem aus Gespräch erkannt."
        : "Standard für Gastrobetriebe ohne POS-Integration.",
      source: hasCashRegister ? "chat" : "rule",
      field: "posIntegration",
      value: hasCashRegister ? "integrated" : "manual",
      status: "pending",
    });

    // Food cost tracking
    suggestions.push({
      id: randomUUID(),
      category: "Wareneinsatz",
      suggestion: "Wareneinsatz-Tracking für F&B aktivieren",
      confidence: 0.87,
      confidenceLevel: "high",
      reason: "Wichtig für Kalkulation und Margenüberwachung in der Gastronomie.",
      source: "rule",
      field: "foodCostTracking",
      value: "enable",
      status: "pending",
    });

    // Tip handling
    suggestions.push({
      id: randomUUID(),
      category: "Trinkgeld",
      suggestion: "Trinkgeld-Konten für korrekte Verbuchung",
      confidence: 0.82,
      confidenceLevel: "needs_review",
      reason: "Trinkgelder müssen korrekt als durchlaufende Posten verbucht werden.",
      source: "rule",
      field: "tipAccounts",
      value: "enable",
      status: "pending",
    });
  }

  // === BAU / HANDWERK ===
  if (industry.includes("bau") || industry.includes("handwerk") || industry.includes("renovation")) {
    // Project accounting
    suggestions.push({
      id: randomUUID(),
      category: "Projektbuchhaltung",
      suggestion: "Projektbasierte Kostenstellen für Bauaufträge",
      confidence: 0.89,
      confidenceLevel: "high",
      reason: "Ermöglicht projektgenaue Nachkalkulation und Margenanalyse.",
      source: "rule",
      field: "projectAccounting",
      value: "enable",
      status: "pending",
    });

    // Akonto handling
    suggestions.push({
      id: randomUUID(),
      category: "Akonto-Rechnungen",
      suggestion: "Akonto-Rechnungsverwaltung mit automatischer Schlussrechnung",
      confidence: 0.91,
      confidenceLevel: "high",
      reason: "Standard im Bauwesen für Teilzahlungen während Projektlaufzeit.",
      source: "rule",
      field: "akontoManagement",
      value: "enable",
      status: "pending",
    });

    // Subcontractor management
    const supplierInsights = insights["supplier"] || [];
    if (supplierInsights.length > 0) {
      suggestions.push({
        id: randomUUID(),
        category: "Subunternehmer",
        suggestion: "Subunternehmer-Verwaltung mit Leistungsnachweisen",
        confidence: 0.84,
        confidenceLevel: "needs_review",
        reason: "Subunternehmer aus Gespräch erkannt.",
        source: "chat",
        field: "subcontractorManagement",
        value: "enable",
        status: "pending",
      });
    }
  }

  // === IT / SOFTWARE ===
  if (industry.includes("it") || industry.includes("software") || industry.includes("tech")) {
    // Recurring revenue
    const revenueInsights = insights["revenue"] || [];
    const hasSubscriptions = revenueInsights.some(i => 
      i.content.toLowerCase().includes("abo") ||
      i.content.toLowerCase().includes("subscription") ||
      i.content.toLowerCase().includes("saas") ||
      i.content.toLowerCase().includes("monatlich")
    );

    if (hasSubscriptions) {
      suggestions.push({
        id: randomUUID(),
        category: "Wiederkehrende Umsätze",
        suggestion: "Abonnement-Verwaltung mit MRR/ARR-Tracking",
        confidence: 0.88,
        confidenceLevel: "high",
        reason: "Wiederkehrende Einnahmen aus Gespräch erkannt.",
        source: "chat",
        field: "subscriptionTracking",
        value: "enable",
        status: "pending",
      });
    }

    // International clients
    const customerInsights = insights["customer"] || [];
    const hasInternational = customerInsights.some(i => 
      i.content.toLowerCase().includes("international") ||
      i.content.toLowerCase().includes("ausland") ||
      i.content.toLowerCase().includes("eu")
    );

    if (hasInternational) {
      suggestions.push({
        id: randomUUID(),
        category: "Internationale Kunden",
        suggestion: "Fremdwährungs-Konten und EU-Reverse-Charge einrichten",
        confidence: 0.85,
        confidenceLevel: "high",
        reason: "Internationale Geschäftstätigkeit aus Gespräch erkannt.",
        source: "chat",
        field: "internationalAccounting",
        value: "enable",
        status: "pending",
      });
    }
  }

  // === HANDEL ===
  if (industry.includes("handel") || industry.includes("retail") || industry.includes("shop")) {
    // Inventory management
    suggestions.push({
      id: randomUUID(),
      category: "Lagerbuchhaltung",
      suggestion: "Lagerbewertung mit Durchschnittspreis-Methode",
      confidence: 0.86,
      confidenceLevel: "high",
      reason: "Wichtig für korrekte Wareneinsatz-Berechnung im Handel.",
      source: "rule",
      field: "inventoryMethod",
      value: "average_cost",
      status: "pending",
    });

    // Margin tracking
    suggestions.push({
      id: randomUUID(),
      category: "Margenanalyse",
      suggestion: "Automatische Margenberechnung pro Warengruppe",
      confidence: 0.83,
      confidenceLevel: "needs_review",
      reason: "Ermöglicht Sortimentsoptimierung basierend auf Deckungsbeitrag.",
      source: "rule",
      field: "marginTracking",
      value: "enable",
      status: "pending",
    });
  }

  // === GESUNDHEIT / PRAXIS ===
  if (industry.includes("gesund") || industry.includes("medizin") || industry.includes("praxis") || industry.includes("therapie")) {
    // Insurance billing
    const revenueInsights = insights["revenue"] || [];
    const hasInsurance = revenueInsights.some(i => 
      i.content.toLowerCase().includes("krankenkasse") ||
      i.content.toLowerCase().includes("versicherung") ||
      i.content.toLowerCase().includes("tarmed")
    );

    if (hasInsurance) {
      suggestions.push({
        id: randomUUID(),
        category: "Krankenkassen-Abrechnung",
        suggestion: "Debitorenverwaltung für Krankenkassen-Forderungen",
        confidence: 0.89,
        confidenceLevel: "high",
        reason: "Krankenkassen-Abrechnung aus Gespräch erkannt.",
        source: "chat",
        field: "insuranceBilling",
        value: "enable",
        status: "pending",
      });
    }

    // Patient accounting
    suggestions.push({
      id: randomUUID(),
      category: "Patientenkonten",
      suggestion: "Separate Debitorenkonten für Selbstzahler vs. Krankenkasse",
      confidence: 0.84,
      confidenceLevel: "needs_review",
      reason: "Ermöglicht saubere Trennung von Zahlungsarten im Gesundheitswesen.",
      source: "rule",
      field: "patientAccounting",
      value: "enable",
      status: "pending",
    });
  }

  // === IMMOBILIEN ===
  if (industry.includes("immobil") || industry.includes("liegen") || industry.includes("verwaltung")) {
    // Property accounting
    suggestions.push({
      id: randomUUID(),
      category: "Liegenschaftsbuchhaltung",
      suggestion: "Objektbasierte Kostenstellen für jede Liegenschaft",
      confidence: 0.91,
      confidenceLevel: "high",
      reason: "Standard für Immobilienverwaltungen zur Abrechnung pro Objekt.",
      source: "rule",
      field: "propertyAccounting",
      value: "by_property",
      status: "pending",
    });

    // Tenant management
    suggestions.push({
      id: randomUUID(),
      category: "Mieterverwaltung",
      suggestion: "Mieterkonten mit automatischer Mahnlaufverwaltung",
      confidence: 0.87,
      confidenceLevel: "high",
      reason: "Wichtig für Mietzins-Monitoring und Zahlungsverfolgung.",
      source: "rule",
      field: "tenantManagement",
      value: "enable",
      status: "pending",
    });

    // STWE/NK accounting
    suggestions.push({
      id: randomUUID(),
      category: "Nebenkostenabrechnung",
      suggestion: "Nebenkostenabrechnung mit Heizkosten-Verteilung",
      confidence: 0.85,
      confidenceLevel: "needs_review",
      reason: "Für korrekte NK-Abrechnungen an Mieter erforderlich.",
      source: "rule",
      field: "utilityBilling",
      value: "enable",
      status: "pending",
    });
  }

  return suggestions;
}
