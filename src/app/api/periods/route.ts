import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const year = parseInt(request.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));

  const periods = await prisma.monthlyPeriod.findMany({
    where: { companyId: ctx.companyId, year },
    orderBy: { month: "asc" },
  });

  // Fill missing months
  const result = [];
  for (let m = 1; m <= 12; m++) {
    const existing = periods.find((p) => p.month === m);
    if (existing) { result.push(existing); }
    else {
      // Count documents for this month
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 1);
      const docCount = await prisma.document.count({
        where: { companyId: ctx.companyId, invoiceDate: { gte: start, lt: end } },
      });
      result.push({ id: null, companyId: ctx.companyId, year, month: m, status: "open", documentsExpected: 0, documentsReceived: docCount, recurringGenerated: false, depreciationGenerated: false, vatChecked: false, exportCompleted: false });
    }
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const { year, month } = await request.json();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const docCount = await prisma.document.count({
      where: { companyId: ctx.companyId, invoiceDate: { gte: start, lt: end } },
    });

    const period = await prisma.monthlyPeriod.upsert({
      where: { companyId_year_month: { companyId: ctx.companyId, year, month } },
      create: { companyId: ctx.companyId, year, month, documentsReceived: docCount },
      update: { documentsReceived: docCount },
    });

    return NextResponse.json(period);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
