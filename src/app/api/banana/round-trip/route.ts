import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { importBananaFile } from "@/lib/services/banana/banana-round-trip";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Stub: return empty batch list — full implementation in Phase 10.1.3
  return NextResponse.json({ batches: [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "integrations:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });

  const csvContent = await file.text();
  const result = await importBananaFile(ctx.companyId, csvContent);

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "banana_round_trip_import",
    entityType: "banana_round_trip",
    entityId: result.importBatchId || ctx.companyId,
    changes: {
      summary: {
        before: null,
        after: `${result.totalRows} Zeilen: ${result.matched} matched, ${result.modified} modified`,
      },
    },
  });

  return NextResponse.json(result);
}
