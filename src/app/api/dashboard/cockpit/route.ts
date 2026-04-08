import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { session, companyId } = ctx;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // --- Parallel data loading ---
  const [
    // 1. For critical alerts
    overdueContracts,
    failedDocsLast24h,
    stuckProcessing,
    failedExportsLast24h,
    overdueTasks,
    // 2. Today stats
    todayUploaded,
    todayReviewed,
    tasksDueToday,
    autoApproveTotal,
    autoApproveAuto,
    // 3. Status counts
    statusCounts,
    // 4. High-risk docs
    highRiskDocs,
    // 5. Open tasks
    openTasks,
    // 6. Period status
    currentPeriod,
    lastPeriod,
  ] = await Promise.all([
    // 1a. Overdue contracts — fetch active/expiring contracts for checking
    prisma.contract.findMany({
      where: { companyId, status: { in: ["active", "expiring"] } },
      select: { id: true, name: true, counterparty: true, frequency: true, startDate: true, endDate: true, reminderDays: true },
    }),
    // 1b. Failed docs last 24h
    prisma.document.count({
      where: { companyId, status: "failed", updatedAt: { gte: yesterday } },
    }),
    // 1c. Stuck processing (>1h)
    prisma.document.count({
      where: { companyId, status: "processing", updatedAt: { lt: oneHourAgo } },
    }),
    // 1d. Failed bexio exports last 24h
    prisma.exportRecord.count({
      where: {
        document: { companyId },
        status: "export_failed",
        createdAt: { gte: yesterday },
      },
    }),
    // 1e. Overdue tasks
    prisma.task.count({
      where: { companyId, status: "open", dueDate: { lt: todayStart } },
    }),
    // 2a. Today uploaded
    prisma.document.count({
      where: { companyId, createdAt: { gte: todayStart } },
    }),
    // 2b. Today reviewed
    prisma.document.count({
      where: { companyId, reviewedAt: { gte: todayStart } },
    }),
    // 2c. Tasks due today
    prisma.task.count({
      where: {
        companyId,
        status: { in: ["open", "in_progress"] },
        dueDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),
    // 2d. Auto-approve quote: total last 30 days
    prisma.document.count({
      where: { companyId, createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["uploaded", "processing"] } },
    }),
    // 2d. Auto-approve quote: auto-approved last 30 days
    prisma.document.count({
      where: { companyId, createdAt: { gte: thirtyDaysAgo }, processingDecision: "auto_ready" },
    }),
    // 3. Status counts
    prisma.document.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    }),
    // 4. High-risk docs: top 5 needs_review by lowest confidence
    prisma.document.findMany({
      where: { companyId, status: "needs_review" },
      orderBy: { confidenceScore: "asc" },
      take: 5,
      select: {
        id: true,
        supplierNameNormalized: true,
        supplierNameRaw: true,
        grossAmount: true,
        currency: true,
        confidenceScore: true,
        createdAt: true,
        processingSteps: {
          where: { status: "completed", metadata: { not: undefined } },
          select: { metadata: true, stepName: true },
          orderBy: { completedAt: "desc" },
          take: 5,
        },
      },
    }),
    // 5. Open tasks: top 5 by priority DESC, dueDate ASC
    prisma.task.findMany({
      where: { companyId, status: { in: ["open", "in_progress"] } },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        taskType: true,
        priority: true,
        dueDate: true,
        relatedDocumentId: true,
      },
    }),
    // 6a. Current period
    prisma.monthlyPeriod.findUnique({
      where: { companyId_year_month: { companyId, year: currentYear, month: currentMonth } },
    }),
    // 6b. Last period
    prisma.monthlyPeriod.findUnique({
      where: { companyId_year_month: { companyId, year: lastMonthYear, month: lastMonth } },
    }),
  ]);

  // --- Process overdue contracts ---
  let overdueContractCount = 0;
  let expiringContractCount = 0;

  for (const c of overdueContracts) {
    let expectedDate: Date | null = null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (c.frequency === "monthly") {
      expectedDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    } else if (c.frequency === "quarterly") {
      const qMonth = Math.floor((today.getMonth() - 1) / 3) * 3;
      expectedDate = new Date(today.getFullYear(), qMonth, 1);
    } else if (c.frequency === "yearly") {
      expectedDate = new Date(today.getFullYear() - 1, c.startDate.getMonth(), 1);
    }

    if (expectedDate) {
      const periodEnd = new Date(expectedDate);
      if (c.frequency === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (c.frequency === "quarterly") periodEnd.setMonth(periodEnd.getMonth() + 3);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      const daysSince = Math.floor((now.getTime() - periodEnd.getTime()) / 86400000);
      if (daysSince > 5) overdueContractCount++;
    }

    if (c.endDate) {
      const daysToEnd = Math.floor((c.endDate.getTime() - now.getTime()) / 86400000);
      if (daysToEnd <= c.reminderDays && daysToEnd > 0) expiringContractCount++;
    }
  }

  // --- Build alerts ---
  const alerts: Array<{ type: "error" | "warning"; message: string; count: number; href: string }> = [];

  if (failedDocsLast24h > 0) {
    alerts.push({ type: "error", message: `${failedDocsLast24h} fehlgeschlagene Belege`, count: failedDocsLast24h, href: "/documents?status=failed" });
  }
  if (overdueContractCount > 0) {
    alerts.push({ type: "error", message: `${overdueContractCount} überfällige Rechnungen`, count: overdueContractCount, href: "/contracts" });
  }
  if (failedExportsLast24h > 0) {
    alerts.push({ type: "error", message: `${failedExportsLast24h} fehlgeschlagene Exporte`, count: failedExportsLast24h, href: "/exports" });
  }
  if (overdueTasks > 0) {
    alerts.push({ type: "error", message: `${overdueTasks} überfällige Pendenzen`, count: overdueTasks, href: "/tasks" });
  }
  if (stuckProcessing > 0) {
    alerts.push({ type: "warning", message: `${stuckProcessing} Belege hängen`, count: stuckProcessing, href: "/documents?status=processing" });
  }

  // needs_review as warning
  const needsReviewCount = statusCounts.find((s) => s.status === "needs_review")?._count || 0;
  if (needsReviewCount > 0) {
    alerts.push({ type: "warning", message: `${needsReviewCount} Belege zur Prüfung`, count: needsReviewCount, href: "/documents?status=needs_review" });
  }
  if (expiringContractCount > 0) {
    alerts.push({ type: "warning", message: `${expiringContractCount} Verträge laufen aus`, count: expiringContractCount, href: "/contracts" });
  }

  // --- Status counts map ---
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    counts[row.status] = row._count;
    total += row._count;
  }

  // --- Today stats ---
  const autoQuote = autoApproveTotal > 0 ? Math.round((autoApproveAuto / autoApproveTotal) * 100) : 0;

  const todayStats = {
    uploaded: todayUploaded,
    reviewed: todayReviewed,
    tasksDue: tasksDueToday,
    autoQuote,
  };

  // --- High-risk docs with escalation reasons ---
  const highRiskDocsFormatted = highRiskDocs.map((doc) => {
    const escalationReasons: string[] = [];
    for (const step of doc.processingSteps) {
      const meta = step.metadata as Record<string, any> | null;
      if (meta?.escalationReasons) {
        escalationReasons.push(...(Array.isArray(meta.escalationReasons) ? meta.escalationReasons : [meta.escalationReasons]));
      }
      if (meta?.reason) {
        escalationReasons.push(meta.reason);
      }
    }
    return {
      id: doc.id,
      supplierName: doc.supplierNameNormalized || doc.supplierNameRaw || "—",
      grossAmount: doc.grossAmount,
      currency: doc.currency,
      confidenceScore: doc.confidenceScore,
      createdAt: doc.createdAt,
      escalationReasons: [...new Set(escalationReasons)],
    };
  });

  // --- Open tasks formatted ---
  const openTasksFormatted = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    taskType: t.taskType,
    priority: t.priority,
    dueDate: t.dueDate,
    relatedDocumentId: t.relatedDocumentId,
  }));

  // --- Period status ---
  function formatPeriod(period: typeof currentPeriod) {
    if (!period) return null;
    return {
      month: period.month,
      year: period.year,
      status: period.status,
      documentsReceived: period.documentsReceived,
      documentsExpected: period.documentsExpected,
      checklistComplete:
        period.recurringGenerated &&
        period.depreciationGenerated &&
        period.vatChecked &&
        period.exportCompleted,
    };
  }

  const periods = {
    current: formatPeriod(currentPeriod),
    last: formatPeriod(lastPeriod),
  };

  // --- Multi-Company: Client Risk Board ---
  let clientRiskBoard: any[] | undefined;

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    select: { companyId: true },
  });

  if (userCompanies.length > 1) {
    const companyIds = userCompanies.map((uc) => uc.companyId);

    clientRiskBoard = await Promise.all(
      companyIds.map(async (cid) => {
        const [company, docCounts, taskCount, contractsRaw, period, lastActivity] = await Promise.all([
          prisma.company.findUnique({ where: { id: cid }, select: { id: true, name: true } }),
          prisma.document.groupBy({
            by: ["status"],
            where: { companyId: cid },
            _count: true,
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
          }),
          prisma.document.findFirst({
            where: { companyId: cid },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);

        const cCounts: Record<string, number> = {};
        for (const row of docCounts) cCounts[row.status] = row._count;
        const needsReview = cCounts.needs_review || 0;

        // Count overdue contracts
        let overdueC = 0;
        for (const ct of contractsRaw) {
          let expectedDate: Date | null = null;
          const td = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (ct.frequency === "monthly") expectedDate = new Date(td.getFullYear(), td.getMonth() - 1, 1);
          else if (ct.frequency === "quarterly") {
            const qm = Math.floor((td.getMonth() - 1) / 3) * 3;
            expectedDate = new Date(td.getFullYear(), qm, 1);
          } else if (ct.frequency === "yearly") expectedDate = new Date(td.getFullYear() - 1, ct.startDate.getMonth(), 1);

          if (expectedDate) {
            const pe = new Date(expectedDate);
            if (ct.frequency === "monthly") pe.setMonth(pe.getMonth() + 1);
            else if (ct.frequency === "quarterly") pe.setMonth(pe.getMonth() + 3);
            else pe.setFullYear(pe.getFullYear() + 1);
            if (Math.floor((now.getTime() - pe.getTime()) / 86400000) > 5) overdueC++;
          }
        }

        const periodBlocked = !period || (period.status !== "closed" && period.status !== "locked");
        const riskScore = needsReview * 3 + taskCount * 2 + overdueC * 5 + (periodBlocked ? 10 : 0);

        return {
          id: company?.id || cid,
          name: company?.name || "—",
          riskScore,
          needsReview,
          overdueTasks: taskCount,
          overdueContracts: overdueC,
          periodStatus: period?.status || "open",
          lastActivity: lastActivity?.createdAt || null,
        };
      })
    );

    clientRiskBoard.sort((a, b) => b.riskScore - a.riskScore);
  }

  return NextResponse.json({
    alerts,
    todayStats,
    statusCounts: { ...counts, total },
    highRiskDocs: highRiskDocsFormatted,
    openTasks: openTasksFormatted,
    periods,
    clientRiskBoard,
  });
}
