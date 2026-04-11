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
    // Rules über IDs laden (primär), Fallback auf Namen (Legacy)
    const rulesStep = steps.find((s) => s.stepName === "rules-engine" || s.stepName === "apply-rules");
    const rulesMeta = rulesStep?.metadata as any;

    const ruleIds: string[] = Array.isArray(rulesMeta?.rulesMatchedIds)
      ? rulesMeta.rulesMatchedIds.filter((id: any) => typeof id === "string")
      : [];
    const ruleNames: string[] = Array.isArray(rulesMeta?.rulesMatched)
      ? rulesMeta.rulesMatched.filter((n: any) => typeof n === "string")
      : [];

    let rulesApplied: any[] = [];
    if (ruleIds.length > 0) {
      // ID-basiert: findet auch globale Regeln (kein Company-Filter nötig)
      rulesApplied = await prisma.rule.findMany({
        where: { id: { in: ruleIds } },
        select: { id: true, name: true, ruleType: true, conditions: true, actions: true, companyId: true },
      });
    } else if (ruleNames.length > 0) {
      // Legacy-Fallback: nur Namen, nur aktuelle Company
      rulesApplied = await prisma.rule.findMany({
        where: { name: { in: ruleNames }, companyId: ctx.companyId },
        select: { id: true, name: true, ruleType: true, conditions: true, actions: true, companyId: true },
      });
    }

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
      ? (() => {
          // safetyChecks enthält den vollständigen Decision Snapshot
          const snapshot = autopilotEvent.safetyChecks as any;
          return {
            decision: autopilotEvent.decision,
            mode: autopilotEvent.mode,
            blockedBy: autopilotEvent.blockedBy,
            // Strukturierter Snapshot statt flacher Cast
            safetyChecks: snapshot?.checks || {},
            suggestion: snapshot?.suggestion || null,
            action: snapshot?.action || null,
            eligible: snapshot?.eligible ?? (autopilotEvent.decision === "eligible"),
            decidedAt: snapshot?.decidedAt || null,
          };
        })()
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
