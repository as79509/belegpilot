import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { detectDrift } from "@/lib/services/autopilot/drift-detection";
import { checkAndApplyDrift } from "@/lib/services/autopilot/autopilot-decision";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "autopilot:read")) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const config = await prisma.autopilotConfig.findUnique({ where: { companyId: ctx.companyId } });
  const report = await detectDrift(ctx.companyId, config?.mode || "shadow");
  return NextResponse.json(report);
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "autopilot:configure")) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await request.json();
  if (body.action === "check_and_apply") {
    const result = await checkAndApplyDrift(ctx.companyId);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
