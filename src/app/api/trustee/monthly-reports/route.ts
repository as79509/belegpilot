import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { generateMonthlySummary } from "@/lib/services/reports/monthly-summary";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Only trustee/admin
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  });
  if (!user || !["admin", "trustee"].includes(user.role)) {
    return NextResponse.json({ error: "Nur Treuh\u00e4nder" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  // Get all companies this user has access to
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: ctx.session.user.id },
    include: { company: { select: { id: true, name: true, status: true } } },
  });

  const activeCompanies = userCompanies
    .filter((uc) => uc.company.status === "active" || !uc.company.status)
    .map((uc) => uc.company);

  // Generate summaries for all clients
  const summaries = await Promise.all(
    activeCompanies.map((c) => generateMonthlySummary(c.id, year, month))
  );

  // Sort: warnings first, then by amount
  summaries.sort((a, b) => {
    const aWarnings = a.anomalies.filter((x) => x.severity === "warning").length;
    const bWarnings = b.anomalies.filter((x) => x.severity === "warning").length;
    if (aWarnings !== bWarnings) return bWarnings - aWarnings;
    return b.overview.totalGrossAmount - a.overview.totalGrossAmount;
  });

  return NextResponse.json({ summaries, year, month });
}
