import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;

    // Sicherstellen, dass das Document zur aktiven Firma gehört
    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // ProcessingSteps in zeitlicher Reihenfolge
    const steps = await prisma.processingStep.findMany({
      where: { documentId: id },
      orderBy: { startedAt: "asc" },
    });

    // Letzte BookingSuggestion
    const suggestion = await prisma.bookingSuggestion.findFirst({
      where: { documentId: id, companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
    });

    // Letzter AutopilotEvent
    const autopilotEvent = await prisma.autopilotEvent.findFirst({
      where: { documentId: id, companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
    });

    // CorrectionEvents
    const corrections = await prisma.correctionEvent.findMany({
      where: { documentId: id, companyId: ctx.companyId },
      orderBy: { createdAt: "asc" },
    });

    // Angewandte Regeln aus rules-engine ProcessingStep extrahieren
    const rulesStep = steps.find((s) => s.stepName === "rules-engine" || s.stepName === "apply-rules");
    const matchedRuleNames: string[] = (() => {
      if (!rulesStep?.metadata) return [];
      const meta = rulesStep.metadata as any;
      const arr = meta?.rulesMatched;
      return Array.isArray(arr) ? arr.filter((n) => typeof n === "string") : [];
    })();

    const rulesApplied = matchedRuleNames.length
      ? await prisma.rule
          .findMany({
            where: { companyId: ctx.companyId, name: { in: matchedRuleNames } },
            select: { id: true, name: true, ruleType: true, actions: true },
          })
          .then((rules) =>
            rules.map((r) => ({
              id: r.id,
              name: r.name,
              ruleType: r.ruleType,
              actions: r.actions,
            }))
          )
      : [];

    // Timeline normalisieren
    const timeline = steps.map((s) => ({
      step: s.stepName,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      durationMs: s.durationMs,
      metadata: s.metadata ?? null,
      errorMessage: s.errorMessage ?? null,
    }));

    const suggestionPayload = suggestion
      ? {
          confidenceScore: suggestion.confidenceScore,
          confidenceLevel: suggestion.confidenceLevel,
          sources:
            (suggestion.reasoning as any)?.sources && Array.isArray((suggestion.reasoning as any).sources)
              ? (suggestion.reasoning as any).sources
              : [],
          suggestedAccount: suggestion.suggestedAccount,
          suggestedCategory: suggestion.suggestedCategory,
          status: suggestion.status,
        }
      : null;

    const autopilotPayload = autopilotEvent
      ? {
          decision: autopilotEvent.decision,
          mode: autopilotEvent.mode,
          safetyChecks: autopilotEvent.safetyChecks as Record<string, boolean>,
          blockedBy: autopilotEvent.blockedBy,
        }
      : null;

    const correctionsPayload = corrections.map((c) => ({
      field: c.field,
      originalValue: c.originalValue ?? "",
      correctedValue: c.correctedValue,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({
      documentId: id,
      timeline,
      suggestion: suggestionPayload,
      autopilot: autopilotPayload,
      corrections: correctionsPayload,
      rulesApplied,
    });
  } catch (err: any) {
    console.error("[decision-replay] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Serverfehler" },
      { status: 500 }
    );
  }
}
