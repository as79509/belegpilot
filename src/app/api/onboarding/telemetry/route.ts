import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { computeOnboardingTelemetry } from "@/lib/services/onboarding/onboarding-telemetry";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "system:health")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const telemetry = await computeOnboardingTelemetry(ctx.companyId);
    return NextResponse.json(telemetry);
  } catch (error: any) {
    console.error("[OnboardingTelemetry] GET failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
