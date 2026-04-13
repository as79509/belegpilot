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
 * Actions:
 * - "start": Get initial question based on context
 * - "respond": Submit answer and get follow-up question
 */

export interface OnboardingInsight {
  id: string;
  type: "revenue" | "cost" | "supplier" | "customer" | "special" | "location" | "employee" | "process";
  content: string;
  confidence: number;
  source: "chat" | "document" | "form";
  extractedAt: string;
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
  try {
    const systemPrompt = `Du bist ein freundlicher Schweizer Buchhaltungs-Assistent.
Generiere eine erste Frage für ein Onboarding-Gespräch.
Die Frage sollte:
- Kurz und freundlich sein (max 2 Sätze)
- Das Geschäftsmodell verstehen helfen
- Den Firmennamen verwenden falls bekannt

Antworte NUR mit der Frage, ohne JSON oder Formatierung.`;

    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: systemPrompt,
      prompt: `Kontext: Firma "${context.companyName || 'unbekannt'}", Branche "${context.industry || 'unbekannt'}", Rechtsform "${context.legalForm || 'unbekannt'}"`,
    });

    return result.text.trim() || getFallbackWelcome(context);
  } catch {
    return getFallbackWelcome(context);
  }
}

function getFallbackWelcome(context: { companyName?: string }): string {
  return `Willkommen${context.companyName ? ` bei ${context.companyName}` : ""}! Was ist die Haupttätigkeit Ihres Unternehmens?`;
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

  try {
    const conversationSummary = previousMessages
      .map(m => `${m.role === "user" ? "Kunde" : "Assistent"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Du bist ein Schweizer Buchhaltungs-Assistent im Onboarding-Gespräch.

Kontext:
- Firma: ${context.companyName || "unbekannt"}
- Branche: ${context.industry || "unbekannt"}
- Rechtsform: ${context.legalForm || "unbekannt"}

Bisheriges Gespräch:
${conversationSummary}

Antworten bisher: ${userMessageCount}

WICHTIG - Extrahiere strukturierte Business Insights:

Insight-Typen:
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
- Extrahiere ALLE relevanten Informationen aus der Antwort
- Confidence: 0.9+ für explizit genannte Fakten, 0.6-0.8 für Interpretationen
- Nach 5 Antworten: complete=true
- Fragen kurz (1-2 Sätze)
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
      
      // Convert raw insights to structured format with IDs
      const structuredInsights: OnboardingInsight[] = (parsed.insights || []).map((i: { type: string; content: string; confidence: number }) => ({
        id: crypto.randomUUID(),
        type: i.type,
        content: i.content,
        confidence: i.confidence || 0.7,
        source: "chat" as const,
        extractedAt: new Date().toISOString(),
      }));

      // Persist insights to draft if draftId provided
      if (draftId && structuredInsights.length > 0) {
        await persistInsights(draftId, userId, structuredInsights);
      }

      return {
        question: parsed.question || undefined,
        response: parsed.complete ? "Vielen Dank! Wir haben genug Informationen für die optimale Einrichtung." : undefined,
        complete: parsed.complete || false,
        insights: structuredInsights,
      };
    }
  } catch (err) {
    console.error("[Questions] AI response failed:", err);
  }

  // Fallback logic
  if (userMessageCount >= 5) {
    return {
      response: "Vielen Dank! Wir haben jetzt genug Informationen.",
      complete: true,
    };
  }

  const fallbackQuestions: Record<number, string> = {
    1: "Arbeiten Sie hauptsächlich mit Geschäftskunden (B2B) oder Privatkunden (B2C)?",
    2: "Welche Lieferanten sind für Ihr Unternehmen besonders wichtig?",
    3: "Welche regelmässigen Ausgaben haben Sie? (Miete, Versicherungen, etc.)",
    4: "Gibt es Besonderheiten, die wir bei der Buchhaltung beachten sollten?",
  };

  return {
    question: fallbackQuestions[userMessageCount] || "Haben Sie weitere wichtige Informationen?",
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
    
    // Merge new insights with existing ones (avoid duplicates by content)
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
