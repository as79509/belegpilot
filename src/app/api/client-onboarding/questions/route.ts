import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, context, userMessage, previousMessages } = body;

    switch (action) {
      case "start": {
        // Generate initial question based on company context
        const question = await generateInitialQuestion(context);
        return NextResponse.json({ question });
      }

      case "respond": {
        // Process user's answer and generate follow-up
        const response = await processUserResponse(
          userMessage,
          context,
          previousMessages || []
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
  } catch (err) {
    console.error("[Questions] AI initial question failed:", err);
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
  previousMessages: Array<{ role: string; content: string }>
): Promise<{
  question?: string;
  response?: string;
  complete?: boolean;
  insights?: Array<{ type: string; content: string }>;
}> {
  // Count user messages to know how far we are
  const userMessageCount = previousMessages.filter(m => m.role === "user").length + 1;
  
  // Topics to cover for fallback logic
  const topics = [
    "Haupttätigkeit und Geschäftsmodell",
    "Kundentyp (B2B/B2C)",
    "Wichtige Lieferanten",
    "Regelmässige Kosten",
    "Besondere Anforderungen"
  ];

  try {
    // Build conversation history
    const conversationSummary = previousMessages
      .map(m => `${m.role === "user" ? "Kunde" : "Assistent"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Du bist ein freundlicher Schweizer Buchhaltungs-Assistent im Onboarding-Gespräch.

Bekannte Informationen:
- Firmenname: ${context.companyName || "noch nicht bekannt"}
- Branche: ${context.industry || "noch nicht bekannt"}
- Rechtsform: ${context.legalForm || "noch nicht bekannt"}

Bisheriges Gespräch:
${conversationSummary}

Anzahl bisheriger Antworten: ${userMessageCount}

Deine Aufgaben:
1. Die neue Antwort verarbeiten
2. Eine passende Folgefrage stellen (WENN noch nicht alle wichtigen Themen abgedeckt sind)
3. Nach ca. 4-5 Antworten das Gespräch abschliessen

Wichtige Themen für die Buchhaltung:
- Geschäftsmodell/Haupttätigkeit
- Kundentyp (B2B/B2C)
- Wichtige Lieferanten
- Regelmässige Kosten/Ausgaben
- Besonderheiten der Branche

Antworte im JSON-Format:
{
  "question": "Nächste Frage falls noch Themen offen" | null,
  "complete": true | false,
  "insights": [{"type": "revenue|cost|supplier|customer|special", "content": "..."}]
}

Regeln:
- Fragen kurz halten (1-2 Sätze)
- Natürlich und freundlich klingen
- Nach 5 Antworten "complete: true" setzen
- Keine Frage die bereits beantwortet wurde`;

    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: systemPrompt,
      prompt: `Neue Antwort vom Kunden: ${userMessage}`,
    });

    const text = result.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        question: parsed.question || undefined,
        response: parsed.complete ? "Vielen Dank! Wir haben jetzt genug Informationen, um Ihre Buchhaltung optimal einzurichten." : undefined,
        complete: parsed.complete || false,
        insights: parsed.insights || [],
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
    1: "Danke! Arbeiten Sie hauptsächlich mit Geschäftskunden (B2B) oder Privatkunden (B2C)?",
    2: "Verstanden. Welche Lieferanten sind für Ihr Unternehmen besonders wichtig?",
    3: "Gut zu wissen. Welche regelmässigen Ausgaben haben Sie? (z.B. Miete, Strom, Versicherungen)",
    4: "Fast fertig! Gibt es Besonderheiten in Ihrem Unternehmen, die wir beachten sollten?",
  };

  return {
    question: fallbackQuestions[userMessageCount] || "Haben Sie noch weitere Informationen, die für die Buchhaltung wichtig sind?",
  };
}
