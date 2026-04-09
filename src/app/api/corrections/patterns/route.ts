import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { getActionablePatterns } from "@/lib/services/corrections/correction-tracker";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!["admin", "reviewer", "trustee"].includes(ctx.session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const patterns = await getActionablePatterns(ctx.companyId);

  return NextResponse.json({
    patterns: patterns.map((p) => ({
      id: p.id,
      field: p.field,
      fromValue: p.fromValue,
      toValue: p.toValue,
      occurrences: p.occurrences,
      supplierId: p.supplierId || null,
      supplierName: p.supplierName,
      firstSeenAt: p.firstSeenAt,
      lastSeenAt: p.lastSeenAt,
      status: p.status,
    })),
  });
}
