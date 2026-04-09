import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

/**
 * Wirkungsanalyse einer Regel:
 * - docsAffected: Anzahl ProcessingSteps mit stepName="rules-engine" wo metadata.rulesMatched
 *   den Regelnamen enthält
 * - lastApplied: Letzte Anwendung
 * - successRate: Anteil der so beeinflussten Belege, die danach als ready/exported und approved markiert wurden
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { id } = await params;
    const rule = await prisma.rule.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!rule) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Suche ProcessingSteps wo dieser Regelname matched ist (JSON contains)
    // metadata: { rulesMatched: ["RuleName1", "RuleName2"] }
    const steps = await prisma.processingStep.findMany({
      where: {
        stepName: "rules-engine",
        document: { companyId: ctx.companyId },
      },
      select: {
        id: true,
        documentId: true,
        completedAt: true,
        metadata: true,
      },
      orderBy: { completedAt: "desc" },
      take: 500,
    });

    const matchingSteps = steps.filter((s) => {
      const meta = s.metadata as any;
      const matched = meta?.rulesMatched as string[] | undefined;
      return Array.isArray(matched) && matched.includes(rule.name);
    });

    const docsAffected = matchingSteps.length;
    const lastApplied = matchingSteps[0]?.completedAt || null;

    let approvedCount = 0;
    if (matchingSteps.length > 0) {
      const docIds = matchingSteps.map((s) => s.documentId);
      approvedCount = await prisma.document.count({
        where: {
          id: { in: docIds },
          reviewStatus: "approved",
        },
      });
    }

    const successRate = docsAffected > 0 ? Math.round((approvedCount / docsAffected) * 100) : null;

    return NextResponse.json({
      docsAffected,
      lastApplied,
      approvedCount,
      successRate,
    });
  } catch (error: any) {
    console.error("[rule impact]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
