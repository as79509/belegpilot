import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

/**
 * Business Questions API for Client Onboarding
 * 
 * GET - Get dynamically generated questions based on the draft data
 * POST - Submit an answer and get AI insights + follow-up question
 * 
 * This provides a real conversational flow, not hardcoded responses.
 */

interface Question {
  id: string;
  question: string;
  category: string;
  priority: "high" | "medium" | "low";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    // Get the current draft to understand what we know
    const draft = await prisma.onboardingDraft.findFirst({
      where: { userId: session.user.id, status: "in_progress" },
    });

    const draftData = (draft?.data as any) || {};
    const answeredIds = draftData.answeredQuestionIds || [];

    // Generate questions based on what's missing
    const questions = generateQuestionsForDraft(draftData, answeredIds);

    return NextResponse.json({
      questions,
      answeredCount: answeredIds.length,
      totalExpected: answeredIds.length + questions.length,
    });
  } catch (error: any) {
    console.error("[ClientOnboarding/Questions] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { questionId, answer, draftData } = body;

    if (!questionId || !answer?.trim()) {
      return NextResponse.json({ error: "Frage-ID und Antwort erforderlich" }, { status: 400 });
    }

    // Find the question that was answered
    const allQuestions = generateQuestionsForDraft(draftData || {}, []);
    const question = allQuestions.find(q => q.id === questionId);

    if (!question) {
      return NextResponse.json({ error: "Frage nicht gefunden" }, { status: 404 });
    }

    // Use Claude to extract insights from the answer
    const result = await extractInsightsFromAnswer(
      question.question,
      answer,
      draftData || {}
    );

    return NextResponse.json({
      success: true,
      insights: result.insights,
      followUpQuestion: result.followUpQuestion,
      suggestedRules: result.suggestedRules,
    });
  } catch (error: any) {
    console.error("[ClientOnboarding/Questions] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateQuestionsForDraft(
  draftData: any,
  answeredIds: string[]
): Question[] {
  const questions: Question[] = [];

  // Q1: Business model (if not known)
  if (!answeredIds.includes("q-business-model")) {
    questions.push({
      id: "q-business-model",
      question: "Was ist die Haupttätigkeit Ihres Unternehmens? Beschreiben Sie kurz, wie Sie Geld verdienen.",
      category: "business",
      priority: "high",
    });
  }

  // Q2: Customer type
  if (!answeredIds.includes("q-customers")) {
    questions.push({
      id: "q-customers",
      question: "Arbeiten Sie hauptsächlich mit Geschäftskunden (B2B) oder Privatkunden (B2C)?",
      category: "business",
      priority: "high",
    });
  }

  // Q3: Employees
  if (!answeredIds.includes("q-employees")) {
    questions.push({
      id: "q-employees",
      question: "Wie viele Mitarbeiter hat Ihr Unternehmen? Gibt es Besonderheiten bei der Lohnbuchhaltung?",
      category: "operations",
      priority: "medium",
    });
  }

  // Q4: Key suppliers
  if (!answeredIds.includes("q-suppliers")) {
    questions.push({
      id: "q-suppliers",
      question: "Welche Lieferanten sind für Ihr Unternehmen besonders wichtig? Nennen Sie die 3-5 wichtigsten.",
      category: "suppliers",
      priority: "high",
    });
  }

  // Q5: Recurring costs
  if (!answeredIds.includes("q-recurring")) {
    questions.push({
      id: "q-recurring",
      question: "Welche regelmässigen Rechnungen erhalten Sie? (z.B. Miete, Strom, Telefon, Versicherung)",
      category: "costs",
      priority: "high",
    });
  }

  // Q6: Special cases (if in specific industries)
  const industry = (draftData.industry || "").toLowerCase();
  if (!answeredIds.includes("q-special") && (
    industry.includes("gastro") || 
    industry.includes("bau") || 
    industry.includes("handel")
  )) {
    questions.push({
      id: "q-special",
      question: "Gibt es Besonderheiten in Ihrer Branche, die wir beachten sollten? (z.B. Bargeldverkehr, Provisionen, Saisongeschäft)",
      category: "special",
      priority: "medium",
    });
  }

  // Q7: Software/platforms
  if (!answeredIds.includes("q-software")) {
    questions.push({
      id: "q-software",
      question: "Nutzen Sie andere Buchhaltungs- oder Business-Software? (z.B. Bexio, Abacus, Kassensystem)",
      category: "integrations",
      priority: "low",
    });
  }

  // Return prioritized questions (max 5)
  return questions
    .filter(q => !answeredIds.includes(q.id))
    .slice(0, 5);
}

async function extractInsightsFromAnswer(
  question: string,
  answer: string,
  draftData: any
): Promise<{
  insights: Array<{ type: string; content: string; confidence: string }>;
  followUpQuestion: string | null;
  suggestedRules: Array<{ type: string; description: string }>;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  // If no API key, return a structured response without AI
  if (!apiKey) {
    console.warn("[ClientOnboarding] No ANTHROPIC_API_KEY set - returning mock insights");
    return {
      insights: [{ 
        type: "info", 
        content: `Antwort erfasst: "${answer.substring(0, 100)}..."`, 
        confidence: "high" 
      }],
      followUpQuestion: null,
      suggestedRules: [],
    };
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `Du bist ein Schweizer Buchhaltungs-Experte. Analysiere die Antwort des Unternehmers und extrahiere nützliche Informationen für die Buchhaltungs-Einrichtung.

Bekannte Informationen über das Unternehmen:
- Firmenname: ${draftData.name || "noch nicht bekannt"}
- Branche: ${draftData.industry || "noch nicht bekannt"}
- Rechtsform: ${draftData.legalForm || "noch nicht bekannt"}
- MwSt-Methode: ${draftData.vatMethod || "noch nicht bekannt"}

Antworte NUR im JSON-Format:
{
  "insights": [{"type": "revenue|cost|supplier|special_case|platform|risk", "content": "...", "confidence": "high|medium|low"}],
  "followUpQuestion": "Eine Folgefrage falls nötig, sonst null",
  "suggestedRules": [{"type": "account_mapping|vat_default|supplier_default", "description": "..."}]
}

Regeln:
- Extrahiere nur Informationen die DIREKT aus der Antwort ableitbar sind
- Folgefrage nur wenn wirklich wichtige Details fehlen
- Maximal 3 Insights pro Antwort`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ 
        role: "user", 
        content: `Frage: ${question}\nAntwort: ${answer}` 
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("[ClientOnboarding] Claude extraction failed:", err);
  }

  // Fallback if AI fails
  return {
    insights: [{ 
      type: "info", 
      content: `Information erfasst`, 
      confidence: "medium" 
    }],
    followUpQuestion: null,
    suggestedRules: [],
  };
}
