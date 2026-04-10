import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { generateQualityReport } from "@/lib/services/quality/period-quality";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;
  const { id } = await params;

  let year: number;
  let month: number;

  if (id.includes("-") && id.length <= 7) {
    const [yearStr, monthStr] = id.split("-");
    year = parseInt(yearStr);
    month = parseInt(monthStr);
  } else {
    const period = await prisma.monthlyPeriod.findFirst({
      where: { id, companyId },
      select: { year: true, month: true },
    });
    if (!period) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    year = period.year;
    month = period.month;
  }

  const report = await generateQualityReport(companyId, year, month);

  return NextResponse.json({ report });
}
