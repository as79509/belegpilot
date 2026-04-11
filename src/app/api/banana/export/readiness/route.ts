import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { checkExportReadiness } from "@/lib/services/banana/export-readiness";

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
