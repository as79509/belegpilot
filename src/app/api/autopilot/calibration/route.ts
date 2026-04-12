import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { calibrateConfidence } from "@/lib/services/autopilot/confidence-calibration";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "autopilot:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const result = await calibrateConfidence(ctx.companyId);
  return NextResponse.json(result);
}
