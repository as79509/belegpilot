import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { getGoLiveStatus, startGoLive, advanceGoLivePhase } from "@/lib/services/onboarding/golive-service";
import { completeStep } from "@/lib/services/onboarding/wizard-service";
import { prisma } from "@/lib/db";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const status = await getGoLiveStatus(ctx.companyId);
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("[GoLive] GET failed:", error);
    return NextResponse.json({ error: "Fehler beim Laden des Go-Live-Status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:execute")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "start") {
      const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
      if (!session) {
        return NextResponse.json({ error: "Keine Onboarding-Session gefunden" }, { status: 404 });
      }

      const status = await startGoLive(ctx.companyId, session.id);

      // Mark step 7 as completed
      await completeStep(session.id, 7, { goLiveStarted: true });

      return NextResponse.json(status);
    }

    if (action === "advance") {
      const status = await advanceGoLivePhase(ctx.companyId);
      return NextResponse.json(status);
    }

    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  } catch (error: any) {
    console.error("[GoLive] POST failed:", error);
    return NextResponse.json({ error: error.message || "Fehler beim Go-Live" }, { status: 500 });
  }
}
