import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { computeSupplierTrustScores } from "@/lib/services/autopilot/supplier-trust";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "suppliers:read")) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const scores = await computeSupplierTrustScores(ctx.companyId);
  return NextResponse.json({ scores });
}
