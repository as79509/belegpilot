import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { computeModuleReadiness, computeReadinessScore } from "@/lib/services/onboarding/wizard-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const moduleReadiness = await computeModuleReadiness(ctx.companyId);
    const readinessScore = computeReadinessScore(moduleReadiness);

    const session = await prisma.onboardingSession.findUnique({
      where: { companyId: ctx.companyId },
    });

    let knownUnknowns = { open: 0, blockers: 0 };
    if (session) {
      const [open, blockers] = await Promise.all([
        prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "open" } }),
        prisma.onboardingKnownUnknown.count({ where: { sessionId: session.id, status: "open", blocksGoLive: true } }),
      ]);
      knownUnknowns = { open, blockers };
    }

    return NextResponse.json({ moduleReadiness, readinessScore, knownUnknowns });
  } catch (error: any) {
    console.error("[Wizard Readiness] Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
