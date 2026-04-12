import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  getOrCreateSession,
  completeStep,
  navigateToStep,
  saveDraft,
} from "@/lib/services/onboarding/wizard-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const state = await getOrCreateSession(ctx.companyId, ctx.session.user.id);
    return NextResponse.json(state);
  } catch (error: any) {
    console.error("[Wizard] GET failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const { action, step, data } = body;
    const current = await getOrCreateSession(ctx.companyId, ctx.session.user.id);

    if (action === "complete_step") {
      if (!step || typeof step !== "number") {
        return NextResponse.json({ error: "Schritt-Nummer erforderlich" }, { status: 400 });
      }

      // Save Company fields for Step 1+2
      if (step === 1 && data) {
        await prisma.company.update({
          where: { id: ctx.companyId },
          data: {
            name: data.name || undefined,
            legalName: data.legalName || undefined,
            legalForm: data.legalForm || undefined,
            uid: data.uid || undefined,
            vatNumber: data.vatNumber || undefined,
            industry: data.industry || undefined,
            subIndustry: data.subIndustry || undefined,
            employeeCount: data.employeeCount ? parseInt(data.employeeCount) : undefined,
            phone: data.phone || undefined,
            email: data.email || undefined,
            website: data.website || undefined,
            businessModel: data.businessModel || undefined,
          },
        });
      }
      if (step === 2 && data) {
        await prisma.company.update({
          where: { id: ctx.companyId },
          data: {
            vatLiable: data.vatLiable ?? undefined,
            vatMethod: data.vatMethod || undefined,
            vatInterval: data.vatInterval || undefined,
            vatFlatRate: data.vatFlatRate ? parseFloat(data.vatFlatRate) : undefined,
            fiscalYearStart: data.fiscalYearStart ? parseInt(data.fiscalYearStart) : undefined,
            costCentersEnabled: data.costCentersEnabled ?? undefined,
            projectsEnabled: data.projectsEnabled ?? undefined,
          },
        });
      }

      const state = await completeStep(current.sessionId, step, data || {});
      return NextResponse.json(state);
    }

    if (action === "navigate") {
      if (!step || typeof step !== "number") {
        return NextResponse.json({ error: "Schritt-Nummer erforderlich" }, { status: 400 });
      }
      const state = await navigateToStep(current.sessionId, step);
      return NextResponse.json(state);
    }

    if (action === "save_draft") {
      if (!step || typeof step !== "number") {
        return NextResponse.json({ error: "Schritt-Nummer erforderlich" }, { status: 400 });
      }
      await saveDraft(current.sessionId, step, data || {});
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch (error: any) {
    console.error("[Wizard] POST failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
