import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { getMappingOverview } from "@/lib/services/banana/banana-mapping";
import { autoMapAccounts } from "@/lib/services/banana/banana-auto-mapper";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const overview = await getMappingOverview(ctx.companyId);
  return NextResponse.json(overview);
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "integrations:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "auto_map") {
    const result = await autoMapAccounts(ctx.companyId);

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "banana_auto_map",
      entityType: "banana_mapping",
      entityId: ctx.companyId,
      changes: {
        mapped: { before: null, after: result.mapped },
        skipped: { before: null, after: result.skipped },
      },
    });

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
