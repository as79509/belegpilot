import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { generateMonthlySummary } from "@/lib/services/reports/monthly-summary";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  if (month < 1 || month > 12 || year < 2000) {
    return NextResponse.json({ error: "Ung\u00fcltiger Monat oder Jahr" }, { status: 400 });
  }

  const summary = await generateMonthlySummary(ctx.companyId, year, month);

  return NextResponse.json({ summary });
}
