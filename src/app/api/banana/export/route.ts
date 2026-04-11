import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { checkExportReadiness } from "@/lib/services/banana/export-readiness";
import { generateBananaExport } from "@/lib/services/banana/banana-export";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const url = request.nextUrl.searchParams;
  const year = parseInt(url.get("year") || "", 10);
  const month = parseInt(url.get("month") || "", 10);

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Jahr und Monat sind erforderlich (year, month)" }, { status: 400 });
  }

  const result = await checkExportReadiness(ctx.companyId, year, month);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "exports:create")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { year, month, includeBlocked } = body;

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Jahr und Monat sind erforderlich" }, { status: 400 });
  }

  const result = await generateBananaExport({
    companyId: ctx.companyId,
    year,
    month,
    includeBlocked: includeBlocked ?? false,
    format: "csv",
  });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "banana_export_created",
    entityType: "banana_export",
    entityId: result.exportRecordId || ctx.companyId,
    changes: {
      exported: { before: null, after: result.exportedCount },
      skipped: { before: null, after: result.skippedCount },
      period: { before: null, after: `${year}-${String(month).padStart(2, "0")}` },
    },
  });

  return new NextResponse(result.data, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "X-Export-Count": String(result.exportedCount),
      "X-Skipped-Count": String(result.skippedCount),
      "X-Export-Record-Id": result.exportRecordId || "",
    },
  });
}
