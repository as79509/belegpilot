import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import {
  getOrCreateSession,
  completeStep,
  navigateToStep,
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

    // Ensure session exists
    const current = await getOrCreateSession(ctx.companyId, ctx.session.user.id);

    if (action === "complete_step") {
      if (!step || typeof step !== "number") {
        return NextResponse.json({ error: "Schritt-Nummer erforderlich" }, { status: 400 });
      }
      const state = await completeStep(current.session.id, step, data || {});
      return NextResponse.json(state);
    }

    if (action === "navigate") {
      if (!step || typeof step !== "number") {
        return NextResponse.json({ error: "Schritt-Nummer erforderlich" }, { status: 400 });
      }
      const state = await navigateToStep(current.session.id, step);
      return NextResponse.json(state);
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch (error: any) {
    console.error("[Wizard] POST failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
