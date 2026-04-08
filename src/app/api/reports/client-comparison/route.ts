import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Get all companies the user has access to
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: ctx.session.user.id },
    include: { company: { select: { id: true, name: true } } },
  });

  if (userCompanies.length <= 1) {
    return NextResponse.json({ error: "Nur für Treuhänder mit mehreren Mandanten verfügbar" }, { status: 403 });
  }

  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const clients = await Promise.all(
    userCompanies.map(async (uc) => {
      const cId = uc.companyId;

      const [documentCount, totalAmountAgg, avgConfidenceAgg, openTasks, period] = await Promise.all([
        prisma.document.count({ where: { companyId: cId } }),
        prisma.document.aggregate({
          where: { companyId: cId },
          _sum: { grossAmount: true },
        }),
        prisma.document.aggregate({
          where: { companyId: cId, confidenceScore: { not: null } },
          _avg: { confidenceScore: true },
        }),
        prisma.task.count({ where: { companyId: cId, status: { in: ["open", "in_progress"] } } }),
        prisma.monthlyPeriod.findFirst({
          where: {
            companyId: cId,
            year: lastMonthStart.getFullYear(),
            month: lastMonthStart.getMonth() + 1,
          },
          select: { status: true },
        }),
      ]);

      return {
        companyId: cId,
        companyName: uc.company.name,
        documentCount,
        totalAmount: Number(totalAmountAgg._sum.grossAmount || 0),
        avgConfidence: Math.round((avgConfidenceAgg._avg.confidenceScore || 0) * 1000) / 1000,
        openTasks,
        periodStatus: period?.status || "open",
      };
    })
  );

  return NextResponse.json({ clients });
}
