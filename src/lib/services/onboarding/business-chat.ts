import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

export interface ChatQuestion {
  id: string;
  category: "revenue" | "costs" | "suppliers" | "special_cases" | "vat" | "contracts" | "deadlines" | "platforms";
  question: string;
  priority: "high" | "medium" | "low";
  reason: string;
  relatedUnknowns: string[];
}

export interface ChatInsight {
  id: string;
  type: "revenue_model" | "typical_cost" | "critical_supplier" | "special_case" | "platform" | "deadline" | "risk" | "vat_special";
  content: string;
  confidence: "high" | "medium" | "low";
  source: "chat";
  confirmed: boolean;
}

export interface ChatExtractionResult {
  insights: ChatInsight[];
  suggestedRules: Array<{ type: string; description: string; confidence: string }>;
  suggestedKnowledge: Array<{ title: string; content: string; confidence: string }>;
  suggestedExpectedDocs: Array<{ name: string; counterparty: string; frequency: string; confidence: string }>;
  resolvedUnknowns: string[];
  newUnknowns: Array<{ area: string; description: string; criticality: string; suggestedAction: string }>;
  followUpQuestions: string[];
}

export async function generatePrioritizedQuestions(companyId: string, sessionId: string, role?: string): Promise<ChatQuestion[]> {
  const [company, session, unknowns, docCount, supplierCount] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { businessModel: true, vatMethod: true, industry: true, vatLiable: true },
    }),
    prisma.onboardingSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { stepData: true },
    }),
    prisma.onboardingKnownUnknown.findMany({
      where: { sessionId, status: "open" },
      select: { id: true, area: true, description: true },
    }),
    prisma.document.count({ where: { companyId } }),
    prisma.supplier.count({ where: { companyId, isVerified: true } }),
  ]);

  const stepData = (session.stepData as Record<string, any>) || {};
  const answeredIds = (stepData["4"]?.answeredQuestions || []).map((q: any) => q.id);
  const expectedDocCount = await prisma.expectedDocument.count({ where: { companyId, isActive: true } });
  const contractCount = await prisma.contract.count({ where: { companyId } });
  const profile = await prisma.businessProfile.findUnique({ where: { companyId } });

  const questions: ChatQuestion[] = [];

  // Revenue model
  if (!company.businessModel && !profile?.revenueModel) {
    questions.push({
      id: "q-revenue",
      category: "revenue",
      question: "Wie verdient Ihr Unternehmen Geld? Beschreiben Sie Ihr Gesch\u00e4ftsmodell in 2-3 S\u00e4tzen.",
      priority: "high",
      reason: "Ohne Gesch\u00e4ftsmodell kann das System keine intelligenten Kontierungsvorschl\u00e4ge machen.",
      relatedUnknowns: unknowns.filter((u) => u.area === "business").map((u) => u.id),
    });
  }

  // Suppliers
  if (supplierCount < 5) {
    questions.push({
      id: "q-suppliers",
      category: "suppliers",
      question: "Welche Lieferanten sind f\u00fcr Ihr Unternehmen besonders wichtig? Nennen Sie die 5 wichtigsten.",
      priority: "high",
      reason: "Wichtige Lieferanten erm\u00f6glichen automatische Kontierung und Erkennung wiederkehrender Rechnungen.",
      relatedUnknowns: unknowns.filter((u) => u.area === "suppliers").map((u) => u.id),
    });
  }

  // Expected documents
  if (expectedDocCount === 0) {
    questions.push({
      id: "q-recurring-costs",
      category: "costs",
      question: "Welche Rechnungen kommen regelm\u00e4ssig? (z.B. Miete, Strom, Telefon, Versicherung, Leasing)",
      priority: "high",
      reason: "Regelm\u00e4ssige Kosten werden als erwartete Belege angelegt \u2014 fehlende werden erkannt.",
      relatedUnknowns: unknowns.filter((u) => u.area === "costs" || u.area === "expected_docs").map((u) => u.id),
    });
  }

  // Contracts
  if (contractCount === 0) {
    questions.push({
      id: "q-contracts",
      category: "contracts",
      question: "Haben Sie laufende Vertr\u00e4ge? (Miete, Leasing, Versicherungen, Abonnemente) Nennen Sie die wichtigsten.",
      priority: "medium",
      reason: "Vertr\u00e4ge mit Fristen erm\u00f6glichen automatische Erinnerungen und Vollst\u00e4ndigkeitspr\u00fcfung.",
      relatedUnknowns: unknowns.filter((u) => u.area === "contracts").map((u) => u.id),
    });
  }

  // VAT special cases
  if (company.vatLiable && (company.vatMethod === "saldo" || company.vatMethod === "pauschal")) {
    questions.push({
      id: "q-vat-special",
      category: "vat",
      question: "Gibt es bei Ihnen MwSt-Sonderf\u00e4lle? (Auslandsgesch\u00e4fte, steuerbefreite Leistungen, gemischte Verwendung)",
      priority: "medium",
      reason: "MwSt-Sonderf\u00e4lle m\u00fcssen als Wissensbasis hinterlegt werden, damit die KI korrekt kontiert.",
      relatedUnknowns: unknowns.filter((u) => u.area === "vat").map((u) => u.id),
    });
  }

  // Platforms (hospitality/tourism)
  const industryLower = (company.industry || "").toLowerCase();
  if (industryLower.includes("gastgewerbe") || industryLower.includes("tourismus") || industryLower.includes("hotell")) {
    questions.push({
      id: "q-platforms",
      category: "platforms",
      question: "Nutzen Sie Plattformen wie Booking.com, Airbnb oder andere OTAs? Welche Kommissionen fallen an?",
      priority: "medium",
      reason: "OTA-Kommissionen erfordern spezielle Kontierung und Abgleich.",
      relatedUnknowns: unknowns.filter((u) => u.area === "platforms").map((u) => u.id),
    });
  }

  // Risk factors / special cases
  if (!profile?.riskFactors || (profile.riskFactors as any[]).length === 0) {
    questions.push({
      id: "q-special-cases",
      category: "special_cases",
      question: "Gibt es besondere Herausforderungen bei Ihrer Buchhaltung? (Privatanteile, Bargeld, Auslandsrechnungen, Sonderf\u00e4lle)",
      priority: "medium",
      reason: "Sonderf\u00e4lle werden als Wissenseintr\u00e4ge gespeichert und bei der Verarbeitung ber\u00fccksichtigt.",
      relatedUnknowns: unknowns.filter((u) => u.area === "special_cases").map((u) => u.id),
    });
  }

  // Deadlines
  if (!profile?.criticalDeadlines || (profile.criticalDeadlines as any[]).length === 0) {
    questions.push({
      id: "q-deadlines",
      category: "deadlines",
      question: "Welche Fristen sind f\u00fcr Sie kritisch? (Jahresabschluss, MwSt-Termine, Vertragsk\u00fcndigungen)",
      priority: "low",
      reason: "Kritische Fristen werden als Erinnerungen hinterlegt.",
      relatedUnknowns: unknowns.filter((u) => u.area === "deadlines").map((u) => u.id),
    });
  }

  // Trustee/Admin: Additional governance questions
  if (role === "admin" || role === "trustee") {
    questions.push({
      id: "q-governance-review",
      category: "special_cases",
      question: "Gibt es Konten die manuell geprüft werden müssen? Welche Autopilot-Grenzen sollen gelten?",
      priority: "medium",
      reason: "Governance-Einstellungen bestimmen den Automatisierungsgrad und Pflicht-Eskalationen.",
      relatedUnknowns: [],
    });
  }

  // Viewer: Remove overly technical questions (MwSt-Sonderfälle, Governance)
  const isViewer = role === "viewer" || role === "readonly";
  const filtered = isViewer
    ? questions.filter((q) => q.category !== "vat" && q.id !== "q-governance-review")
    : questions;

  // Filter already answered and sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const maxQuestions = isViewer ? 3 : 5;
  return filtered
    .filter((q) => !answeredIds.includes(q.id))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, maxQuestions);
}

export async function extractInsightsFromAnswer(
  companyId: string,
  sessionId: string,
  questionId: string,
  answer: string
): Promise<ChatExtractionResult> {
  const [company, profile, unknowns] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { industry: true, legalForm: true, vatMethod: true },
    }),
    prisma.businessProfile.findUnique({ where: { companyId } }),
    prisma.onboardingKnownUnknown.findMany({
      where: { sessionId, status: "open" },
      select: { id: true, area: true, description: true },
    }),
  ]);

  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    select: { nameNormalized: true },
    take: 20,
  });
  const supplierNames = suppliers.map((s) => s.nameNormalized).join(", ");
  const existingInsights = profile?.insights ? JSON.stringify(profile.insights) : "[]";

  // Find the question text
  const allQuestions = await generatePrioritizedQuestions(companyId, sessionId);
  const questionText = allQuestions.find((q) => q.id === questionId)?.question || questionId;

  const systemPrompt = `Du bist ein Schweizer Buchhaltungs-Experte. Analysiere die folgende Antwort eines Unternehmers oder Treuh\u00e4nders und extrahiere daraus strukturierte Gesch\u00e4ftsinformationen.

Kontext des Unternehmens:
- Branche: ${company.industry || "unbekannt"}
- Rechtsform: ${company.legalForm || "unbekannt"}
- MwSt: ${company.vatMethod || "unbekannt"}
- Bekannte Lieferanten: ${supplierNames || "keine"}
- Bisherige Insights: ${existingInsights}

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "insights": [{"type": "revenue_model|typical_cost|critical_supplier|special_case|platform|deadline|risk|vat_special", "content": "...", "confidence": "high|medium|low"}],
  "suggestedRules": [{"type": "supplier_to_account|category_mapping|vat_default", "description": "..."}],
  "suggestedKnowledge": [{"title": "...", "content": "..."}],
  "suggestedExpectedDocs": [{"name": "...", "counterparty": "...", "frequency": "monthly|quarterly|yearly"}],
  "followUpQuestions": ["..."],
  "resolvedTopics": ["..."]
}

Regeln:
- Nur Informationen extrahieren die DIREKT aus der Antwort ableitbar sind
- confidence: "high" wenn explizit genannt, "medium" wenn ableitbar, "low" wenn spekulativ
- Keine Erfindungen oder Vermutungen \u00fcber nicht genannte Details`;

  let parsed: any = { insights: [], suggestedRules: [], suggestedKnowledge: [], suggestedExpectedDocs: [], followUpQuestions: [], resolvedTopics: [] };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Frage: " + questionText + "\nAntwort: " + answer }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("[BusinessChat] Claude extraction failed:", err);
  }

  // Map insights with IDs
  const insights: ChatInsight[] = (parsed.insights || []).map((i: any) => ({
    id: randomUUID(),
    type: i.type,
    content: i.content,
    confidence: i.confidence || "medium",
    source: "chat" as const,
    confirmed: false,
  }));

  // Resolve matching unknowns
  const resolvedUnknowns: string[] = [];
  for (const topic of parsed.resolvedTopics || []) {
    const topicLower = (topic as string).toLowerCase();
    for (const u of unknowns) {
      if (u.description.toLowerCase().includes(topicLower) || topicLower.includes(u.area)) {
        resolvedUnknowns.push(u.id);
      }
    }
  }

  // Update resolved unknowns in DB
  if (resolvedUnknowns.length > 0) {
    await prisma.onboardingKnownUnknown.updateMany({
      where: { id: { in: resolvedUnknowns } },
      data: { status: "resolved", resolvedAt: new Date(), resolution: "Beantwortet in Gesch\u00e4ftsmodell-Chat" },
    });
  }

  // Update BusinessProfile
  if (profile) {
    const existingArray = (profile.insights as any[]) || [];
    const existingRules = (profile.suggestedRules as any[]) || [];
    const existingKnowledge = (profile.suggestedKnowledge as any[]) || [];
    const existingExpected = (profile.suggestedExpectedDocs as any[]) || [];

    await prisma.businessProfile.update({
      where: { id: profile.id },
      data: {
        insights: [...existingArray, ...insights] as any,
        suggestedRules: [...existingRules, ...(parsed.suggestedRules || [])] as any,
        suggestedKnowledge: [...existingKnowledge, ...(parsed.suggestedKnowledge || [])] as any,
        suggestedExpectedDocs: [...existingExpected, ...(parsed.suggestedExpectedDocs || [])] as any,
      },
    });
  } else {
    // Create BusinessProfile if it doesn't exist
    await prisma.businessProfile.create({
      data: {
        companyId,
        sessionId,
        insights: insights as any,
        suggestedRules: (parsed.suggestedRules || []) as any,
        suggestedKnowledge: (parsed.suggestedKnowledge || []) as any,
        suggestedExpectedDocs: (parsed.suggestedExpectedDocs || []) as any,
      },
    });
  }

  return {
    insights,
    suggestedRules: parsed.suggestedRules || [],
    suggestedKnowledge: parsed.suggestedKnowledge || [],
    suggestedExpectedDocs: parsed.suggestedExpectedDocs || [],
    resolvedUnknowns,
    newUnknowns: [],
    followUpQuestions: parsed.followUpQuestions || [],
  };
}
