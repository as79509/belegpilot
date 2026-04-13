import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

/**
 * AI Suggestions API for Client Onboarding
 * 
 * POST - Generate AI suggestions based on all collected data
 * PATCH - Update suggestion status (accept/reject)
 */

export interface AISuggestion {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  reason?: string;
  field?: string;
  value?: string;
  status: "pending" | "accepted" | "rejected";
}

// POST - Generate suggestions based on collected data
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { draftId, formData, chatMessages, uploadedFiles } = body;

    // Generate suggestions based on provided data
    const suggestions = await generateSuggestions({
      ...formData,
      chatHistory: chatMessages?.map((m: string) => ({ role: "user", content: m })) || [],
      uploadedDocumentIds: uploadedFiles || [],
    });

    // If we have a draftId, save suggestions to draft
    if (draftId) {
      const existingDraft = await prisma.onboardingDraft.findFirst({
        where: { id: draftId, userId: session.user.id },
      });

      if (existingDraft) {
        const existingData = existingDraft.data as Record<string, unknown>;
        await prisma.onboardingDraft.update({
          where: { id: draftId },
          data: {
            data: {
              ...existingData,
              aiSuggestions: suggestions,
            },
          },
        });
      }
    }

    return NextResponse.json({
      suggestions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[ClientOnboarding/Suggestions] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update suggestion status
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

    // Get the draft
    const draft = await prisma.onboardingDraft.findFirst({
      where: { id: draftId, userId: session.user.id },
    });

    if (!draft) {
      return NextResponse.json({ error: "Entwurf nicht gefunden" }, { status: 404 });
    }

    // Update the suggestion in the draft data
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
    console.error("[ClientOnboarding/Suggestions] PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateSuggestions(draftData: Record<string, unknown>): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [];
  
  const industry = ((draftData.industry as string) || "").toLowerCase();
  const legalForm = ((draftData.legalForm as string) || "").toLowerCase();
  const vatMethod = (draftData.vatMethod as string) || "effektiv";
  const vatLiable = draftData.vatLiable !== false;
  const chatHistory = (draftData.chatHistory as Array<{ role: string; content: string }>) || [];
  
  // Extract user messages from chat
  const userMessages = chatHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  // 1. Chart of Accounts suggestion
  const chartSuggestion = getChartOfAccountsSuggestion(industry, legalForm);
  suggestions.push({
    id: randomUUID(),
    category: "Kontenrahmen",
    suggestion: chartSuggestion.suggestion,
    confidence: chartSuggestion.confidence,
    reason: chartSuggestion.reason,
    field: "chartOfAccounts",
    value: chartSuggestion.value,
    status: "pending",
  });

  // 2. Cost center suggestion
  const costCenterSuggestion = getCostCenterSuggestion(industry, userMessages);
  suggestions.push({
    id: randomUUID(),
    category: "Kostenstellen",
    suggestion: costCenterSuggestion.suggestion,
    confidence: costCenterSuggestion.confidence,
    reason: costCenterSuggestion.reason,
    field: "costCenters",
    value: costCenterSuggestion.value,
    status: "pending",
  });

  // 3. Document categories suggestion
  suggestions.push({
    id: randomUUID(),
    category: "Belegkategorien",
    suggestion: "Standard-Belegkategorien mit branchenspezifischen Ergänzungen",
    confidence: 0.85,
    reason: `Basierend auf der Branche "${(draftData.industry as string) || 'Allgemein'}" werden passende Kategorien vorgeschlagen.`,
    field: "documentCategories",
    value: industry ? `standard_${industry}` : "standard",
    status: "pending",
  });

  // 4. VAT configuration
  if (vatLiable) {
    suggestions.push({
      id: randomUUID(),
      category: "MwSt-Konfiguration",
      suggestion: getVatSuggestion(vatMethod),
      confidence: 0.9,
      reason: `${vatMethod === "effektiv" ? "Effektive Methode" : "Saldosteuersatz"} ausgewählt - entsprechende MwSt-Konten werden eingerichtet.`,
      field: "vatConfig",
      value: vatMethod,
      status: "pending",
    });
  }

  // 5. AI Autonomy suggestion
  const autonomySuggestion = getAutonomySuggestion(industry);
  suggestions.push({
    id: randomUUID(),
    category: "KI-Autonomie",
    suggestion: autonomySuggestion.suggestion,
    confidence: autonomySuggestion.confidence,
    reason: "Empfehlung basierend auf Branche und typischen Anforderungen.",
    field: "aiConfidenceThreshold",
    value: autonomySuggestion.value,
    status: "pending",
  });

  // 6. Industry-specific suggestions
  const industrySuggestions = getIndustrySuggestions(industry, userMessages);
  suggestions.push(...industrySuggestions);

  return suggestions;
}

function getChartOfAccountsSuggestion(industry: string, legalForm: string): {
  suggestion: string;
  confidence: number;
  reason: string;
  value: string;
} {
  // KMU chart for small businesses
  if (legalForm === "einzelfirma" || legalForm === "gmbh") {
    return {
      suggestion: "KMU-Kontenrahmen (vereinfacht)",
      confidence: 0.92,
      reason: "Optimal für kleine und mittlere Unternehmen mit der gewählten Rechtsform.",
      value: "kmu_simplified",
    };
  }

  // Käfer for hospitality
  if (industry.includes("gastro") || industry.includes("hotel")) {
    return {
      suggestion: "Käfer-Kontenrahmen für Hotellerie & Gastronomie",
      confidence: 0.88,
      reason: "Branchenspezifischer Kontenrahmen mit speziellen Konten für F&B, Logis, etc.",
      value: "kaefer_gastro",
    };
  }

  // Default
  return {
    suggestion: "KMU-Kontenrahmen",
    confidence: 0.85,
    reason: "Standard-Kontenrahmen für Schweizer KMU.",
    value: "kmu",
  };
}

function getCostCenterSuggestion(industry: string, userMessages: string): {
  suggestion: string;
  confidence: number;
  reason: string;
  value: string;
} {
  // Check for multi-location hints
  if (userMessages.includes("standort") || 
      userMessages.includes("filiale") ||
      userMessages.includes("niederlassung")) {
    return {
      suggestion: "Kostenstellen nach Standorten/Filialen",
      confidence: 0.82,
      reason: "Mehrere Standorte erkannt - Kostenstellenstruktur empfohlen.",
      value: "by_location",
    };
  }

  // Hospitality often needs departments
  if (industry.includes("gastro") || industry.includes("hotel")) {
    return {
      suggestion: "Kostenstellen nach Abteilungen (Küche, Service, Bar, Verwaltung)",
      confidence: 0.85,
      reason: "Typische Abteilungsstruktur für Gastrobetriebe.",
      value: "by_department_gastro",
    };
  }

  // Default: simple structure
  return {
    suggestion: "Einfache Kostenstellenstruktur ohne Untergliederung",
    confidence: 0.88,
    reason: "Für die meisten kleinen Unternehmen ist eine einfache Struktur ausreichend.",
    value: "simple",
  };
}

function getVatSuggestion(vatMethod: string): string {
  if (vatMethod === "saldo") {
    return "Saldosteuersatz-Konten mit automatischer Berechnung";
  }
  if (vatMethod === "pauschal") {
    return "Pauschalsteuersatz-Konfiguration für Landwirtschaft";
  }
  return "Effektive MwSt-Konten mit Vorsteuerabzug (7.7%, 2.5%, 3.7%)";
}

function getAutonomySuggestion(industry: string): {
  suggestion: string;
  confidence: number;
  value: string;
} {
  // Conservative for complex industries
  if (industry.includes("bau") || industry.includes("immobilien")) {
    return {
      suggestion: "Konservative KI-Einstellung (>80% Konfidenz für Auto-Genehmigung)",
      confidence: 0.78,
      value: "0.80",
    };
  }
  
  // More autonomy for simple businesses
  if (industry.includes("beratung") || industry.includes("it")) {
    return {
      suggestion: "Moderate KI-Autonomie (>65% Konfidenz) - geeignet für standardisierte Geschäftsprozesse",
      confidence: 0.82,
      value: "0.65",
    };
  }

  return {
    suggestion: "Ausgewogene KI-Einstellung (>70% Konfidenz für automatische Kontierung)",
    confidence: 0.75,
    value: "0.70",
  };
}

function getIndustrySuggestions(industry: string, userMessages: string): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  if (industry.includes("gastro") || industry.includes("hotel")) {
    suggestions.push({
      id: randomUUID(),
      category: "Branchenspezifisch",
      suggestion: "Kassenbuch-Integration und Trinkgeld-Konten aktivieren",
      confidence: 0.8,
      reason: "Standard für Gastrobetriebe mit Bargeldverkehr.",
      field: "features",
      value: "cash_register_tips",
      status: "pending",
    });
  }

  if (industry.includes("handel")) {
    suggestions.push({
      id: randomUUID(),
      category: "Branchenspezifisch",
      suggestion: "Wareneingangs- und Lagerkonten einrichten",
      confidence: 0.78,
      reason: "Wichtig für Handelsbetriebe mit Wareneinkauf.",
      field: "features",
      value: "inventory_tracking",
      status: "pending",
    });
  }

  if (industry.includes("bau")) {
    suggestions.push({
      id: randomUUID(),
      category: "Branchenspezifisch",
      suggestion: "Projektbezogene Kostenerfassung und Anzahlungskonten",
      confidence: 0.82,
      reason: "Typisch für Baubetriebe mit Projektgeschäft.",
      field: "features",
      value: "project_accounting",
      status: "pending",
    });
  }

  return suggestions;
}
