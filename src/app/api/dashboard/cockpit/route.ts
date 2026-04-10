import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { computeRiskScore } from "@/lib/services/cockpit/risk-score";
import { buildAlerts } from "@/lib/services/cockpit/alert-builder";
import { getCompanyActions } from "@/lib/services/actions/next-action";
import { getQualityScore } from "@/lib/services/quality/period-quality";

function countOverdueContracts(contracts: Array<{ frequency: string; startDate: Date; endDate: Date | null; reminderDays: number }>, now: Date) {
  let overdueCount = 0;
  let expiringCount = 0;

  for (const c of contracts) {
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
      if (daysSince > 5) overdueCount++;
    }

    if (c.endDate) {
      const daysToEnd = Math.floor((c.endDate.getTime() - now.getTime()) / 86400000);
      if (daysToEnd <= c.reminderDays && daysToEnd > 0) expiringCount++;
    }
  }

  return { overdueCount, expiringCount };
}

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

  const [
    contractsRaw,
    failedDocsLast24h,
    stuckProcessing,
    failedExportsLast24h,
    overdueTasks,
    todayUploaded,
    todayReviewed,
    tasksDueToday,
    autoApproveTotal,
    autoApproveAuto,
    statusCounts,
    highRiskDocs,
    openTasks,
    currentPeriod,
    lastPeriod,
    waitingOnClient,
  ] = await Promise.all([
    prisma.contract.findMany({
      where: { companyId, status: { in: ["active", "expiring"] } },
      select: { frequency: true, startDate: true, endDate: true, reminderDays: true },
    }),
    prisma.document.count({
      where: { companyId, status: "failed", updatedAt: { gte: yesterday } },
    }),
    prisma.document.count({
      where: { companyId, status: "processing", updatedAt: { lt: oneHourAgo } },
    }),
    prisma.exportRecord.count({
      where: { document: { companyId }, status: "export_failed", createdAt: { gte: yesterday } },
    }),
    prisma.task.count({
      where: { companyId, status: "open", dueDate: { lt: todayStart } },
    }),
    prisma.document.count({
      where: { companyId, createdAt: { gte: todayStart } },
    }),
    prisma.document.count({
      where: { companyId, reviewedAt: { gte: todayStart } },
    }),
    prisma.task.count({
      where: {
        companyId,
        status: { in: ["open", "in_progress"] },
        dueDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.document.count({
      where: { companyId, createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["uploaded", "processing"] } },
    }),
    prisma.document.count({
      where: { companyId, createdAt: { gte: thirtyDaysAgo }, processingDecision: "auto_ready" },
    }),
    prisma.document.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    }),
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
        decisionReasons: true,
      },
    }),
    prisma.task.findMany({
      where: { companyId, status: { in: ["open", "in_progress"] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 5,
      select: { id: true, title: true, taskType: true, priority: true, dueDate: true, relatedDocumentId: true },
    }),
    prisma.monthlyPeriod.findUnique({
      where: { companyId_year_month: { companyId, year: currentYear, month: currentMonth } },
    }),
    prisma.monthlyPeriod.findUnique({
      where: { companyId_year_month: { companyId, year: lastMonthYear, month: lastMonth } },
    }),
    prisma.task.findMany({
      where: { companyId, messageBody: { not: null }, messageSentAt: { not: null }, status: { in: ["open", "in_progress"] } },
      take: 5,
      orderBy: { messageSentAt: "asc" },
      select: { id: true, title: true, taskType: true, messageSentAt: true },
    }),
  ]);

  // Suggestion Stats (last 30 days)
  const [totalSuggestions, acceptedSuggestions, rejectedSuggestions, modifiedSuggestions] = await Promise.all([
    prisma.bookingSuggestion.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.bookingSuggestion.count({ where: { companyId, status: "accepted", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.bookingSuggestion.count({ where: { companyId, status: "rejected", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.bookingSuggestion.count({ where: { companyId, status: "modified", createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  const suggestionAcceptRate = totalSuggestions > 0
    ? Math.round(((acceptedSuggestions + modifiedSuggestions) / totalSuggestions) * 100)
    : 0;

  // Autopilot Stats (last 30 days)
  const [autopilotEligible, autopilotBlocked, autopilotTotal, autopilotConfig] = await Promise.all([
    prisma.autopilotEvent.count({ where: { companyId, decision: "eligible", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.autopilotEvent.count({ where: { companyId, decision: "blocked", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.autopilotEvent.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.autopilotConfig.findUnique({
      where: { companyId },
      select: { enabled: true, mode: true, killSwitchActive: true },
    }),
  ]);

  const autopilotEligibleRate = autopilotTotal > 0
    ? Math.round((autopilotEligible / autopilotTotal) * 100)
    : 0;

  // Personal Review Speed (today, current user)
  const reviewActions = await prisma.auditLog.findMany({
    where: {
      companyId,
      userId: session.user.id,
      createdAt: { gte: todayStart },
      action: { in: ["document_approved", "document_bulk_approved", "document_rejected", "document_bulk_rejected"] },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const reviewedToday = reviewActions.length;
  let todayMinutes = 0;
  let avgSecondsPerDoc = 0;
  if (reviewedToday >= 2) {
    const first = reviewActions[0].createdAt.getTime();
    const last = reviewActions[reviewActions.length - 1].createdAt.getTime();
    const spanMs = Math.max(0, last - first);
    todayMinutes = Math.max(1, Math.round(spanMs / 60000));
    avgSecondsPerDoc = Math.max(1, Math.round(spanMs / 1000 / reviewedToday));
  } else if (reviewedToday === 1) {
    todayMinutes = 1;
    avgSecondsPerDoc = 60;
  }

  const reviewSpeed = {
    todayReviewed: reviewedToday,
    todayMinutes,
    avgSecondsPerDoc,
  };

  // Personal Today (current user counters)
  const [
    personalRulesCreated,
    personalSuppliersVerified,
    personalSuggestionsAccepted,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: {
        companyId,
        userId: session.user.id,
        createdAt: { gte: todayStart },
        action: "rule_created",
      },
    }),
    prisma.auditLog.count({
      where: {
        companyId,
        userId: session.user.id,
        createdAt: { gte: todayStart },
        action: "supplier_verified",
      },
    }),
    prisma.auditLog.count({
      where: {
        companyId,
        userId: session.user.id,
        createdAt: { gte: todayStart },
        action: "suggestion_accepted",
      },
    }),
  ]);

  const personalToday = {
    reviewed: reviewedToday,
    rulesCreated: personalRulesCreated,
    suppliersVerified: personalSuppliersVerified,
    suggestionsAccepted: personalSuggestionsAccepted,
  };

  // Contract overdue counts
  const { overdueCount: overdueContractCount, expiringCount: expiringContractCount } = countOverdueContracts(contractsRaw, now);

  // Needs review count
  const needsReviewCount = statusCounts.find((s) => s.status === "needs_review")?._count || 0;

  // Build alerts using centralized service
  const alerts = buildAlerts({
    failedDocs: failedDocsLast24h,
    overdueContracts: overdueContractCount,
    failedExports: failedExportsLast24h,
    overdueTasks,
    stuckProcessing,
    needsReview: needsReviewCount,
    expiringContracts: expiringContractCount,
  });

  // Status counts map
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    counts[row.status] = row._count;
    total += row._count;
  }

  // Today stats
  const autoQuote = autoApproveTotal > 0 ? Math.round((autoApproveAuto / autoApproveTotal) * 100) : 0;
  const todayStats = { uploaded: todayUploaded, reviewed: todayReviewed, tasksDue: tasksDueToday, autoQuote };

  // High-risk docs — now using decisionReasons directly
  const highRiskDocsFormatted = highRiskDocs.map((doc) => {
    const reasons = doc.decisionReasons as Record<string, any> | null;
    const escalationReasons: string[] = reasons?.escalations || [];
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

  // Open tasks
  const openTasksFormatted = openTasks.map((t) => ({
    id: t.id, title: t.title, taskType: t.taskType, priority: t.priority, dueDate: t.dueDate, relatedDocumentId: t.relatedDocumentId,
  }));

  // Period status
  function formatPeriod(period: typeof currentPeriod) {
    if (!period) return null;
    return {
      month: period.month, year: period.year, status: period.status,
      documentsReceived: period.documentsReceived, documentsExpected: period.documentsExpected,
      checklistComplete: period.recurringGenerated && period.depreciationGenerated && period.vatChecked && period.exportCompleted,
    };
  }

  const periods = { current: formatPeriod(currentPeriod), last: formatPeriod(lastPeriod) };

  // Multi-Company: Client Risk Board
  let clientRiskBoard: any[] | undefined;

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    select: { companyId: true },
  });

  if (userCompanies.length > 1) {
    const companyIds = userCompanies.map((uc) => uc.companyId);

    clientRiskBoard = await Promise.all(
      companyIds.map(async (cid) => {
        const [company, docCounts, taskCount, cContracts, period, lastActivity] = await Promise.all([
          prisma.company.findUnique({ where: { id: cid }, select: { id: true, name: true } }),
          prisma.document.groupBy({ by: ["status"], where: { companyId: cid }, _count: true }),
          prisma.task.count({ where: { companyId: cid, status: "open", dueDate: { lt: todayStart } } }),
          prisma.contract.findMany({
            where: { companyId: cid, status: { in: ["active", "expiring"] } },
            select: { frequency: true, startDate: true, endDate: true, reminderDays: true },
          }),
          prisma.monthlyPeriod.findUnique({
            where: { companyId_year_month: { companyId: cid, year: currentYear, month: currentMonth } },
          }),
          prisma.document.findFirst({ where: { companyId: cid }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        ]);

        const cCounts: Record<string, number> = {};
        for (const row of docCounts) cCounts[row.status] = row._count;
        const needsReview = cCounts.needs_review || 0;
        const { overdueCount: overdueC } = countOverdueContracts(cContracts, now);

        const riskScore = computeRiskScore({
          needsReview,
          overdueTasks: taskCount,
          overdueContracts: overdueC,
          periodStatus: period?.status || "open",
        });

        return {
          id: company?.id || cid, name: company?.name || "—", riskScore, needsReview,
          overdueTasks: taskCount, overdueContracts: overdueC,
          periodStatus: period?.status || "open", lastActivity: lastActivity?.createdAt || null,
        };
      })
    );

    clientRiskBoard.sort((a, b) => b.riskScore - a.riskScore);
  }

  const suggestionStats = {
    total: totalSuggestions,
    accepted: acceptedSuggestions,
    rejected: rejectedSuggestions,
    modified: modifiedSuggestions,
    acceptRate: suggestionAcceptRate,
  };

  // Unpaid Documents (Phase 9.2.2)
  const allDocsWithAmount = await prisma.document.findMany({
    where: { companyId, grossAmount: { not: null }, status: { notIn: ["rejected", "failed", "archived"] } },
    select: { id: true, grossAmount: true, dueDate: true },
  });

  const paidDocIds = new Set(
    (await prisma.bankTransaction.findMany({
      where: { companyId, matchStatus: { in: ["auto_matched", "manual_matched"] }, matchedDocumentId: { not: null } },
      select: { matchedDocumentId: true },
    })).map((t) => t.matchedDocumentId)
  );

  const unpaidDocs = allDocsWithAmount.filter((d) => !paidDocIds.has(d.id));
  const unpaidCount = unpaidDocs.length;
  const unpaidTotal = unpaidDocs.reduce((s, d) => s + Number(d.grossAmount || 0), 0);
  const overdueDocs = unpaidDocs.filter((d) => d.dueDate && d.dueDate < todayStart);
  const overdueCount = overdueDocs.length;

  // Next Best Actions (Top 5)
  const allCompanyActions = await getCompanyActions(companyId);
  const nextActions = allCompanyActions.slice(0, 5);

  const autopilotStats = {
    eligible: autopilotEligible,
    blocked: autopilotBlocked,
    total: autopilotTotal,
    eligibleRate: autopilotEligibleRate,
    config: autopilotConfig
      ? {
          enabled: autopilotConfig.enabled,
          mode: autopilotConfig.mode,
          killSwitchActive: autopilotConfig.killSwitchActive,
        }
      : { enabled: false, mode: "shadow", killSwitchActive: false },
  };

  // Quality score for current month
  let qualityScore: number | null = null;
  try {
    qualityScore = await getQualityScore(companyId, currentYear, currentMonth);
  } catch {}

  return NextResponse.json({
    alerts, todayStats, statusCounts: { ...counts, total },
    highRiskDocs: highRiskDocsFormatted, openTasks: openTasksFormatted,
    periods, clientRiskBoard, waitingOnClient, suggestionStats, autopilotStats, nextActions,
    reviewSpeed, personalToday,
    unpaidDocs: { count: unpaidCount, total: unpaidTotal, overdueCount: overdueCount },
    qualityScore,
  });
}
