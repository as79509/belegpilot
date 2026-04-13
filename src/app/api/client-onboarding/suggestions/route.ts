import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

/**
 * AI Suggestions API for Client Onboarding
 * 
 * GET - Generate AI suggestions based on all collected data
 * POST - Not used (suggestions are generated on GET)
 * 
 * Suggestions are generated based on:
 * - Business basics (name, legal form, industry)
 * - Accounting setup (VAT config, fiscal year)
 * - Uploaded documents (if any)
 * - Chat answers (business insights)
 */

export interface AISuggestion {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  reason: string;
  status: "pending" | "accepted" | "rejected";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const draft = await prisma.onboardingDraft.findFirst({
      where: { userId: session.user.id, status: "in_progress" },
    });

    if (!draft) {
      return NextResponse.json({ error: "Kein Entwurf gefunden" }, { status: 404 });
    }

    const draftData = draft.data as any;
    
    // Generate suggestions based on collected data
    const suggestions = await generateSuggestions(draftData);

    return NextResponse.json({
      suggestions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[ClientOnboarding/Suggestions] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function generateSuggestions(draftData: any): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [];
  
  const industry = (draftData.industry || "").toLowerCase();
  const legalForm = (draftData.legalForm || "").toLowerCase();
  const vatMethod = draftData.vatMethod || "effektiv";
  const chatHistory = draftData.chatHistory || [];
  
  // Extract any user messages from chat
  const userMessages = chatHistory
    .filter((m: any) => m.role === "user")
    .map((m: any) => m.content)
    .join(" ");

  // 1. Chart of Accounts suggestion
  if (industry) {
    const chartSuggestion = getChartOfAccountsSuggestion(industry, legalForm);
    suggestions.push({
      id: randomUUID(),
      category: "Kontenrahmen",
      suggestion: chartSuggestion.suggestion,
      confidence: chartSuggestion.confidence,
      reason: chartSuggestion.reason,
      status: "pending",
    });
  }

  // 2. Cost center suggestion
  const costCenterSuggestion = getCostCenterSuggestion(industry, userMessages);
  suggestions.push({
    id: randomUUID(),
    category: "Kostenstellen",
    suggestion: costCenterSuggestion.suggestion,
    confidence: costCenterSuggestion.confidence,
    reason: costCenterSuggestion.reason,
    status: "pending",
  });

  // 3. Document categories suggestion
  suggestions.push({
    id: randomUUID(),
    category: "Belegkategorien",
    suggestion: "Standard-Belegkategorien mit branchenspezifischen Ergänzungen",
    confidence: 0.85,
    reason: `Basierend auf der Branche "${draftData.industry || 'Allgemein'}" werden passende Kategorien vorgeschlagen.`,
    status: "pending",
  });

  // 4. VAT configuration
  if (draftData.vatLiable) {
    suggestions.push({
      id: randomUUID(),
      category: "MwSt-Konfiguration",
      suggestion: getVatSuggestion(vatMethod),
      confidence: 0.9,
      reason: `${vatMethod === "effektiv" ? "Effektive Methode" : "Saldosteuersatz"} ausgewählt - entsprechende MwSt-Konten werden eingerichtet.`,
      status: "pending",
    });
  }

  // 5. AI Autonomy suggestion
  suggestions.push({
    id: randomUUID(),
    category: "KI-Autonomie",
    suggestion: getAutonomySuggestion(industry),
    confidence: 0.75,
    reason: "Empfehlung basierend auf Branche und typischen Anforderungen.",
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
} {
  // KMU chart for small businesses
  if (legalForm === "einzelfirma" || legalForm === "gmbh") {
    return {
      suggestion: "KMU-Kontenrahmen (vereinfacht)",
      confidence: 0.92,
      reason: "Optimal für kleine und mittlere Unternehmen mit der gewählten Rechtsform.",
    };
  }

  // Käfer for hospitality
  if (industry.includes("gastro") || industry.includes("hotel")) {
    return {
      suggestion: "Käfer-Kontenrahmen für Hotellerie & Gastronomie",
      confidence: 0.88,
      reason: "Branchenspezifischer Kontenrahmen mit speziellen Konten für F&B, Logis, etc.",
    };
  }

  // Default
  return {
    suggestion: "KMU-Kontenrahmen",
    confidence: 0.85,
    reason: "Standard-Kontenrahmen für Schweizer KMU.",
  };
}

function getCostCenterSuggestion(industry: string, userMessages: string): {
  suggestion: string;
  confidence: number;
  reason: string;
} {
  // Check for multi-location hints
  if (userMessages.toLowerCase().includes("standort") || 
      userMessages.toLowerCase().includes("filiale") ||
      userMessages.toLowerCase().includes("niederlassung")) {
    return {
      suggestion: "Kostenstellen nach Standorten/Filialen",
      confidence: 0.82,
      reason: "Mehrere Standorte erkannt - Kostenstellenstruktur empfohlen.",
    };
  }

  // Hospitality often needs departments
  if (industry.includes("gastro") || industry.includes("hotel")) {
    return {
      suggestion: "Kostenstellen nach Abteilungen (Küche, Service, Bar, Verwaltung)",
      confidence: 0.85,
      reason: "Typische Abteilungsstruktur für Gastrobetriebe.",
    };
  }

  // Default: simple structure
  return {
    suggestion: "Einfache Kostenstellenstruktur ohne Untergliederung",
    confidence: 0.88,
    reason: "Für die meisten kleinen Unternehmen ist eine einfache Struktur ausreichend.",
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

function getAutonomySuggestion(industry: string): string {
  // Conservative for complex industries
  if (industry.includes("bau") || industry.includes("immobilien")) {
    return "Konservative KI-Einstellung (>80% Konfidenz für Auto-Genehmigung)";
  }
  
  // More autonomy for simple businesses
  if (industry.includes("beratung") || industry.includes("it")) {
    return "Moderate KI-Autonomie (>65% Konfidenz) - geeignet für standardisierte Geschäftsprozesse";
  }

  return "Ausgewogene KI-Einstellung (>70% Konfidenz für automatische Kontierung)";
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
      status: "pending",
    });
  }

  return suggestions;
}
