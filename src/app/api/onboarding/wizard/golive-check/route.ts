import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { checkGoLiveReadiness } from "@/lib/services/onboarding/golive-check";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const session = await prisma.onboardingSession.findUnique({
    where: { companyId: ctx.companyId },
  });
  if (!session) {
    return NextResponse.json({ error: "Keine Onboarding-Session gefunden" }, { status: 404 });
  }

  try {
    const result = await checkGoLiveReadiness(ctx.companyId, session.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[GoLive Check] Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
