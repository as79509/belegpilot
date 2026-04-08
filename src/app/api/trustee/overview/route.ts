import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeRiskScore } from "@/lib/services/cockpit/risk-score";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    include: { company: { select: { id: true, name: true } } },
  });

  if (userCompanies.length <= 1) {
    return NextResponse.json({ companies: [] });
  }

  const companyIds = userCompanies.map((uc) => uc.companyId);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const companies = await Promise.all(
    companyIds.map(async (cid) => {
      const company = userCompanies.find((uc) => uc.companyId === cid)!.company;

      const [statusCounts, lastDoc, bexioIntegration, overdueTaskCount, contractsRaw, currentPeriod] = await Promise.all([
        prisma.document.groupBy({
          by: ["status"],
          where: { companyId: cid },
          _count: true,
        }),
        prisma.document.findFirst({
          where: { companyId: cid },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.integration.findFirst({
          where: { companyId: cid, providerType: "export", providerName: "bexio" },
          select: { isEnabled: true },
        }),
        prisma.task.count({
          where: { companyId: cid, status: "open", dueDate: { lt: todayStart } },
        }),
        prisma.contract.findMany({
          where: { companyId: cid, status: { in: ["active", "expiring"] } },
          select: { frequency: true, startDate: true, endDate: true, reminderDays: true },
        }),
        prisma.monthlyPeriod.findUnique({
          where: { companyId_year_month: { companyId: cid, year: currentYear, month: currentMonth } },
          select: { status: true },
        }),
      ]);

      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of statusCounts) {
        counts[row.status] = row._count;
        total += row._count;
      }

      const ready = (counts.ready || 0) + (counts.exported || 0);
      const needsReview = counts.needs_review || 0;

      // Count overdue contracts
      let overdueContractCount = 0;
      for (const ct of contractsRaw) {
        let expectedDate: Date | null = null;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (ct.frequency === "monthly") {
          expectedDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        } else if (ct.frequency === "quarterly") {
          const qMonth = Math.floor((today.getMonth() - 1) / 3) * 3;
          expectedDate = new Date(today.getFullYear(), qMonth, 1);
        } else if (ct.frequency === "yearly") {
          expectedDate = new Date(today.getFullYear() - 1, ct.startDate.getMonth(), 1);
        }

        if (expectedDate) {
          const periodEnd = new Date(expectedDate);
          if (ct.frequency === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
          else if (ct.frequency === "quarterly") periodEnd.setMonth(periodEnd.getMonth() + 3);
          else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          const daysSince = Math.floor((now.getTime() - periodEnd.getTime()) / 86400000);
          if (daysSince > 5) overdueContractCount++;
        }
      }

      const periodStatus = currentPeriod?.status || "open";

      const riskScore = computeRiskScore({
        needsReview,
        overdueTasks: overdueTaskCount,
        overdueContracts: overdueContractCount,
        periodStatus,
      });

      return {
        id: cid,
        name: company.name,
        stats: {
          needs_review: needsReview,
          ready: counts.ready || 0,
          failed: counts.failed || 0,
          exported: counts.exported || 0,
          total,
        },
        progress: total > 0 ? Math.round((ready / total) * 100) : 0,
        lastUpload: lastDoc?.createdAt || null,
        bexioConfigured: bexioIntegration?.isEnabled || false,
        riskScore,
        overdueTasks: overdueTaskCount,
        overdueContracts: overdueContractCount,
        currentPeriodStatus: periodStatus,
        criticalIssue: null,
      };
    })
  );

  companies.sort((a, b) => b.riskScore - a.riskScore);

  return NextResponse.json({ companies });
}
