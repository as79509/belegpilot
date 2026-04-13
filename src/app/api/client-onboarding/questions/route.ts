import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateText } from "ai";

/**
 * Business Questions API for Client Onboarding
 * Uses Vercel AI Gateway for zero-config AI access
 * 
 * POST - Start conversation or respond to questions
 * 
 * Features:
 * - Industry-specific question flows
 * - Structured insight extraction
 * - AI-powered follow-up questions
 */

export interface OnboardingInsight {
  id: string;
  type: "revenue" | "cost" | "supplier" | "customer" | "special" | "location" | "employee" | "process";
  content: string;
  confidence: number;
  source: "chat" | "document" | "form";
  extractedAt: string;
}

// Industry-specific question configurations
const INDUSTRY_QUESTIONS: Record<string, {
  initial: string;
  followUps: string[];
  focusAreas: string[];
}> = {
  "gastronomie": {
    initial: "Betreiben Sie ein Restaurant, Café oder Bar? Wie viele Sitzplätze haben Sie etwa?",
    followUps: [
      "Haben Sie verschiedene Abteilungen wie Küche, Service und Bar separat?",
      "Wie rechnen Sie ab - mit Kassensystem oder manuell?",
      "Bieten Sie Catering oder Lieferservice an?",
      "Wie viele festangestellte und Teilzeit-Mitarbeiter haben Sie etwa?",
    ],
    focusAreas: ["revenue", "employee", "process", "cost"],
  },
  "handel": {
    initial: "Verkaufen Sie online, im Ladengeschäft oder beides? Was sind Ihre Hauptprodukte?",
    followUps: [
      "Wie viele verschiedene Artikel führen Sie etwa im Sortiment?",
      "Wer sind Ihre wichtigsten Lieferanten?",
      "Verkaufen Sie an Privatkunden oder auch an Firmen?",
      "Haben Sie ein Lager oder arbeiten Sie mit Dropshipping?",
    ],
    focusAreas: ["supplier", "customer", "revenue", "cost"],
  },
  "dienstleistungen": {
    initial: "Was für Dienstleistungen bieten Sie an? Arbeiten Sie hauptsächlich mit Firmen oder Privatpersonen?",
    followUps: [
      "Rechnen Sie nach Stunden oder mit Pauschalen ab?",
      "Haben Sie wiederkehrende Kunden mit regelmässigen Aufträgen?",
      "Arbeiten Sie alleine oder mit einem Team?",
      "Gibt es projektbasierte Kosten wie Reisen oder Materialien?",
    ],
    focusAreas: ["customer", "revenue", "process", "cost"],
  },
  "bau": {
    initial: "In welchem Baubereich sind Sie tätig? Hausbau, Renovationen oder spezialisierte Arbeiten?",
    followUps: [
      "Arbeiten Sie als Generalunternehmer oder Subunternehmer?",
      "Wie lange dauern Ihre Projekte typischerweise?",
      "Welche Materiallieferanten nutzen Sie regelmässig?",
      "Wie handhaben Sie Akonto-Zahlungen und Schlussrechnungen?",
    ],
    focusAreas: ["supplier", "process", "revenue", "special"],
  },
  "it": {
    initial: "Bieten Sie Softwareentwicklung, IT-Support oder beides an?",
    followUps: [
      "Arbeiten Sie mit Abonnements, Projekten oder Support-Verträgen?",
      "Haben Sie internationale Kunden?",
      "Nutzen Sie externe Entwickler oder Freelancer?",
      "Welche Cloud-Dienste oder Lizenzen sind wichtige Kostenpunkte?",
    ],
    focusAreas: ["revenue", "cost", "customer", "process"],
  },
  "immobilien": {
    initial: "Verwalten Sie Liegenschaften, vermitteln Sie oder beides?",
    followUps: [
      "Wie viele Objekte betreuen Sie etwa?",
      "Kassieren Sie Mieten für Eigentümer ein?",
      "Wie rechnen Sie mit den Eigentümern ab?",
      "Fallen regelmässig Unterhalts- oder Renovationskosten an?",
    ],
    focusAreas: ["revenue", "cost", "process", "special"],
  },
  "gesundheit": {
    initial: "In welchem Gesundheitsbereich sind Sie tätig? Praxis, Therapie oder Pflege?",
    followUps: [
      "Rechnen Sie über Krankenkassen ab oder direkt mit Patienten?",
      "Haben Sie Angestellte oder arbeiten Sie selbständig?",
      "Welche Materialen oder Medikamente müssen Sie einkaufen?",
      "Gibt es spezielle Dokumentationspflichten in Ihrem Bereich?",
    ],
    focusAreas: ["revenue", "employee", "cost", "special"],
  },
};

// Default questions for industries not specifically covered
const DEFAULT_QUESTIONS = {
  initial: "Was ist die Haupttätigkeit Ihres Unternehmens?",
  followUps: [
    "Arbeiten Sie hauptsächlich mit Geschäftskunden (B2B) oder Privatkunden (B2C)?",
    "Welche Lieferanten oder Partner sind für Ihr Unternehmen wichtig?",
    "Welche regelmässigen Ausgaben haben Sie? (Miete, Versicherungen, etc.)",
    "Gibt es Besonderheiten, die wir bei der Buchhaltung beachten sollten?",
  ],
  focusAreas: ["revenue", "cost", "supplier", "customer"],
};

function getIndustryConfig(industry: string | undefined): typeof DEFAULT_QUESTIONS {
  if (!industry) return DEFAULT_QUESTIONS;
  
  const normalizedIndustry = industry.toLowerCase();
  
  // Match industry to config
  if (normalizedIndustry.includes("gastro") || normalizedIndustry.includes("hotel") || normalizedIndustry.includes("restaurant")) {
    return INDUSTRY_QUESTIONS["gastronomie"];
  }
  if (normalizedIndustry.includes("handel") || normalizedIndustry.includes("retail") || normalizedIndustry.includes("shop")) {
    return INDUSTRY_QUESTIONS["handel"];
  }
  if (normalizedIndustry.includes("beratung") || normalizedIndustry.includes("dienst") || normalizedIndustry.includes("agentur")) {
    return INDUSTRY_QUESTIONS["dienstleistungen"];
  }
  if (normalizedIndustry.includes("bau") || normalizedIndustry.includes("handwerk") || normalizedIndustry.includes("renovation")) {
    return INDUSTRY_QUESTIONS["bau"];
  }
  if (normalizedIndustry.includes("it") || normalizedIndustry.includes("software") || normalizedIndustry.includes("tech")) {
    return INDUSTRY_QUESTIONS["it"];
  }
  if (normalizedIndustry.includes("immobil") || normalizedIndustry.includes("liegen") || normalizedIndustry.includes("verwaltung")) {
    return INDUSTRY_QUESTIONS["immobilien"];
  }
  if (normalizedIndustry.includes("gesund") || normalizedIndustry.includes("medizin") || normalizedIndustry.includes("praxis") || normalizedIndustry.includes("therapie")) {
    return INDUSTRY_QUESTIONS["gesundheit"];
  }
  
  return DEFAULT_QUESTIONS;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, draftId, context, userMessage, previousMessages } = body;

    switch (action) {
      case "start": {
        const question = await generateInitialQuestion(context);
        return NextResponse.json({ question });
      }

      case "respond": {
        const response = await processUserResponse(
          userMessage,
          context,
          previousMessages || [],
          draftId,
          session.user.id
        );
        return NextResponse.json(response);
      }

      default:
        return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[ClientOnboarding/Questions] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateInitialQuestion(context: {
  companyName?: string;
  legalForm?: string;
  industry?: string;
}): Promise<string> {
  const industryConfig = getIndustryConfig(context.industry);
  
  try {
    const systemPrompt = `Du bist ein freundlicher Schweizer Buchhaltungs-Assistent.
Generiere eine personalisierte Willkommensfrage für das Onboarding.

Kontext:
- Firma: ${context.companyName || "unbekannt"}
- Branche: ${context.industry || "unbekannt"}
- Rechtsform: ${context.legalForm || "unbekannt"}

Basis-Frage für diese Branche: "${industryConfig.initial}"

Regeln:
- Personalisiere die Frage mit dem Firmennamen falls bekannt
- Bleibe bei max 2 Sätzen
- Sei freundlich und professionell
- Antworte NUR mit der Frage, ohne JSON`;

    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: systemPrompt,
      prompt: "Generiere die personalisierte Willkommensfrage:",
    });

    return result.text.trim() || getFallbackWelcome(context, industryConfig);
  } catch {
    return getFallbackWelcome(context, industryConfig);
  }
}

function getFallbackWelcome(
  context: { companyName?: string },
  industryConfig: typeof DEFAULT_QUESTIONS
): string {
  const greeting = context.companyName 
    ? `Willkommen${context.companyName ? ` bei ${context.companyName}` : ""}! `
    : "Willkommen! ";
  return greeting + industryConfig.initial;
}

async function processUserResponse(
  userMessage: string,
  context: {
    companyName?: string;
    legalForm?: string;
    industry?: string;
  },
  previousMessages: Array<{ role: string; content: string }>,
  draftId: string | undefined,
  userId: string
): Promise<{
  question?: string;
  response?: string;
  complete?: boolean;
  insights?: OnboardingInsight[];
}> {
  const userMessageCount = previousMessages.filter(m => m.role === "user").length + 1;
  const industryConfig = getIndustryConfig(context.industry);

  try {
    const conversationSummary = previousMessages
      .map(m => `${m.role === "user" ? "Kunde" : "Assistent"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Du bist ein Schweizer Buchhaltungs-Assistent im Onboarding-Gespräch.

Kontext:
- Firma: ${context.companyName || "unbekannt"}
- Branche: ${context.industry || "unbekannt"} (Fokus auf: ${industryConfig.focusAreas.join(", ")})
- Rechtsform: ${context.legalForm || "unbekannt"}

Bisheriges Gespräch:
${conversationSummary}

Antworten bisher: ${userMessageCount}

Verfügbare Folgefragen für diese Branche:
${industryConfig.followUps.map((q, i) => `${i + 1}. ${q}`).join("\n")}

WICHTIG - Extrahiere strukturierte Business Insights:

Insight-Typen (fokussiere auf ${industryConfig.focusAreas.join(", ")}):
- "revenue": Umsatzquellen, Hauptprodukte, Preismodelle
- "cost": Regelmässige Kosten, grosse Ausgaben
- "supplier": Lieferanten, Einkaufspartner
- "customer": Kundentyp (B2B/B2C), Zielgruppe
- "special": Branchenbesonderheiten, Sonderfälle
- "location": Standorte, Filialen
- "employee": Mitarbeiterzahl, Lohnstruktur
- "process": Geschäftsprozesse, Abläufe

Antworte IMMER im JSON-Format:
{
  "question": "Nächste Frage" | null,
  "complete": false | true,
  "insights": [
    {
      "type": "revenue|cost|supplier|customer|special|location|employee|process",
      "content": "Extrahierte Information",
      "confidence": 0.0-1.0
    }
  ]
}

Regeln:
- Wähle sinnvolle Folgefragen aus der Liste oder generiere branchenspezifische
- Extrahiere ALLE relevanten Informationen aus der Antwort
- Confidence: 0.9+ für explizit genannte Fakten, 0.6-0.8 für Interpretationen
- Nach ${Math.min(industryConfig.followUps.length + 1, 5)} Antworten: complete=true
- Nicht nach bereits beantworteten Themen fragen`;

    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: systemPrompt,
      prompt: `Neue Antwort: ${userMessage}`,
    });

    const text = result.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const structuredInsights: OnboardingInsight[] = (parsed.insights || []).map((i: { type: string; content: string; confidence: number }) => ({
        id: crypto.randomUUID(),
        type: i.type,
        content: i.content,
        confidence: i.confidence || 0.7,
        source: "chat" as const,
        extractedAt: new Date().toISOString(),
      }));

      if (draftId && structuredInsights.length > 0) {
        await persistInsights(draftId, userId, structuredInsights);
      }

      return {
        question: parsed.question || undefined,
        response: parsed.complete ? "Vielen Dank! Wir haben genug Informationen für die optimale Einrichtung Ihrer Buchhaltung." : undefined,
        complete: parsed.complete || false,
        insights: structuredInsights,
      };
    }
  } catch (err) {
    console.error("[Questions] AI response failed:", err);
  }

  // Fallback logic with industry-specific questions
  const maxQuestions = Math.min(industryConfig.followUps.length + 1, 5);
  
  if (userMessageCount >= maxQuestions) {
    return {
      response: "Vielen Dank! Wir haben jetzt genug Informationen für Ihre Buchhaltungseinrichtung.",
      complete: true,
    };
  }

  const fallbackQuestion = industryConfig.followUps[userMessageCount - 1] 
    || "Haben Sie weitere wichtige Informationen für uns?";

  return {
    question: fallbackQuestion,
  };
}

async function persistInsights(
  draftId: string,
  userId: string,
  newInsights: OnboardingInsight[]
): Promise<void> {
  try {
    const draft = await prisma.onboardingDraft.findFirst({
      where: { id: draftId, userId },
    });

    if (!draft) return;

    const draftData = draft.data as Record<string, unknown>;
    const existingInsights = (draftData.businessInsights as OnboardingInsight[]) || [];
    
    const mergedInsights = [...existingInsights];
    for (const newInsight of newInsights) {
      const exists = mergedInsights.some(
        e => e.content.toLowerCase() === newInsight.content.toLowerCase()
      );
      if (!exists) {
        mergedInsights.push(newInsight);
      }
    }

    await prisma.onboardingDraft.update({
      where: { id: draftId },
      data: {
        data: {
          ...draftData,
          businessInsights: mergedInsights,
        },
      },
    });
  } catch (err) {
    console.error("[Questions] Failed to persist insights:", err);
  }
}
