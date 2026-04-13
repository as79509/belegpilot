import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { assessFailureModes } from "@/lib/services/onboarding/failure-handler";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
    if (!session) return NextResponse.json({ overallStatus: "ok", failures: [], goLiveRestrictions: [], recommendedActions: [] });

    const assessment = await assessFailureModes(ctx.companyId, session.id);
    return NextResponse.json(assessment);
  } catch (error: any) {
    console.error("[Failures] GET failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
