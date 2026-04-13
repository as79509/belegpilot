import { prisma } from "@/lib/db";

export interface FailureAssessment {
  overallStatus: "ok" | "degraded" | "critical";
  failures: Array<{
    area: string;
    type: "insufficient_data" | "contradictory" | "missing_config" | "weak_patterns" | "unclear_chat";
    description: string;
    impact: string;
    fallback: string;
    modulesAffected: string[];
  }>;
  goLiveRestrictions: string[];
  recommendedActions: string[];
}

export async function assessFailureModes(companyId: string, sessionId: string): Promise<FailureAssessment> {
  const [docCount, supplierCount, accountCount, openUnknowns, profile, session] = await Promise.all([
    prisma.document.count({ where: { companyId } }),
    prisma.supplier.count({ where: { companyId, isVerified: true } }),
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.onboardingKnownUnknown.count({ where: { sessionId, status: "open" } }),
    prisma.businessProfile.findUnique({ where: { companyId } }),
    prisma.onboardingSession.findUniqueOrThrow({ where: { id: sessionId }, select: { stepData: true } }),
  ]);

  const stepData = (session.stepData as Record<string, any>) || {};
  const bootstrapResult = stepData["5"] || {};
  const bootstrapRules = bootstrapResult.bootstrapSummary?.byType?.rule || 0;
  const insightsCount = Array.isArray(profile?.insights) ? (profile.insights as any[]).length : 0;

  const failures: FailureAssessment["failures"] = [];
  const goLiveRestrictions: string[] = [];
  const recommendedActions: string[] = [];

  // Insufficient data: documents
  if (docCount < 10) {
    failures.push({
      area: "belege",
      type: "insufficient_data",
      description: "Zu wenige Belege für verlässliche Mustererkennung",
      impact: "KI-Vorschläge basieren auf unzureichender Datenbasis",
      fallback: "Autopilot nur Shadow, verstärktes Review",
      modulesAffected: ["autopilot", "suggestions", "belege"],
    });
    goLiveRestrictions.push("Autopilot nur im Beobachtungsmodus (zu wenige Belege)");
    recommendedActions.push("Mindestens 20 typische Belege hochladen");
  }

  // Insufficient data: suppliers
  if (supplierCount < 3) {
    failures.push({
      area: "lieferanten",
      type: "insufficient_data",
      description: "Zu wenige Lieferanten erkannt",
      impact: "Keine automatische Lieferanten-Kontierung möglich",
      fallback: "Keine Supplier-to-Account Rules",
      modulesAffected: ["lieferanten", "suggestions"],
    });
    recommendedActions.push("Wichtigste Lieferanten manuell anlegen oder über Belege importieren");
  }

  // Missing config: accounts
  if (accountCount < 10) {
    failures.push({
      area: "kontenplan",
      type: "missing_config",
      description: "Kontenplan unvollständig",
      impact: "Kontierungsautomatik nicht möglich",
      fallback: "Keine Kontierungsautomatik, manuelle Kontierung nötig",
      modulesAffected: ["kontenplan", "autopilot", "banana"],
    });
    goLiveRestrictions.push("Keine automatische Kontierung (Kontenplan unvollständig)");
    recommendedActions.push("Kontenplan importieren (mindestens 10 aktive Konten)");
  }

  // Weak patterns: bootstrap rules
  if (bootstrapRules < 3) {
    failures.push({
      area: "regeln",
      type: "weak_patterns",
      description: "Zu wenige Kontierungsmuster erkannt",
      impact: "Manuelle Kontierung für die meisten Belege nötig",
      fallback: "Manuelle Kontierung nötig",
      modulesAffected: ["autopilot", "suggestions"],
    });
    recommendedActions.push("Mehr Belege mit unterschiedlichen Kategorien hochladen");
  }

  // Unclear chat: insights
  if (insightsCount < 3) {
    failures.push({
      area: "geschaeftsmodell",
      type: "unclear_chat",
      description: "Geschäftsmodell nicht ausreichend erklärt",
      impact: "Generische statt mandantenspezifische Vorschläge",
      fallback: "Generische statt mandantenspezifische Vorschläge",
      modulesAffected: ["suggestions"],
    });
    recommendedActions.push("Geschäftsmodell-Fragen im Chat beantworten");
  }

  // Contradictory: check for suppliers with many different accounts
  const contradictorySuppliers = await prisma.$queryRaw<Array<{ supplier_name: string; account_count: bigint }>>`
    SELECT "supplier_name_normalized" as "supplier_name", COUNT(DISTINCT "account_code") as "account_count"
    FROM "documents"
    WHERE "company_id" = ${companyId} AND "account_code" IS NOT NULL AND "supplier_name_normalized" IS NOT NULL
    GROUP BY "supplier_name_normalized"
    HAVING COUNT(DISTINCT "account_code") > 3
    LIMIT 5
  `;

  if (contradictorySuppliers.length > 0) {
    const names = contradictorySuppliers.map(s => s.supplier_name).join(", ");
    failures.push({
      area: "kontierung",
      type: "contradictory",
      description: `Widersprüchliche Kontierung bei: ${names}`,
      impact: "KI kann kein eindeutiges Muster ableiten",
      fallback: "Betroffene Lieferanten auf manuelle Prüfung",
      modulesAffected: ["autopilot", "suggestions"],
    });
    goLiveRestrictions.push("Widersprüchliche Kontierung bei einigen Lieferanten — manuelle Prüfung nötig");
  }

  // Overall status
  const autopilotFailures = failures.filter(f => f.modulesAffected.includes("autopilot")).length;
  const overallStatus: FailureAssessment["overallStatus"] =
    autopilotFailures > 2 ? "critical" : failures.length > 0 ? "degraded" : "ok";

  return { overallStatus, failures, goLiveRestrictions, recommendedActions };
}
