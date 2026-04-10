import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    company,
    openTasks,
    expectedDocuments,
    statusCounts,
    contracts,
    recentLogs,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, status: true },
    }),
    prisma.task.findMany({
      where: { companyId, status: { in: ["open", "in_progress"] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 20,
      select: { id: true, title: true, priority: true, dueDate: true, taskType: true },
    }),
    prisma.expectedDocument.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, counterparty: true, frequency: true, createdAt: true },
    }),
    prisma.document.groupBy({
      by: ["status"],
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd } },
      _count: true,
    }),
    prisma.contract.findMany({
      where: { companyId, status: { in: ["active", "expiring"] }, endDate: { lte: thirtyDaysFromNow, gte: now } },
      select: { id: true, name: true, endDate: true },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, entityType: true, entityId: true, createdAt: true },
    }),
  ]);

  // Missing documents check
  const missingDocuments: Array<{
    id: string; description: string; expectedDate: string | null;
    supplierName: string | null; daysPastDue: number;
  }> = [];

  for (const ed of expectedDocuments) {
    const isExpectedThisMonth = ed.frequency === "monthly" ||
      (ed.frequency === "quarterly" && (now.getMonth() + 1) % 3 === 1) ||
      (ed.frequency === "yearly" && ed.createdAt.getMonth() === now.getMonth());

    if (!isExpectedThisMonth) continue;

    const matchingDoc = await prisma.document.findFirst({
      where: {
        companyId,
        invoiceDate: { gte: monthStart, lt: monthEnd },
        OR: [
          { supplierNameNormalized: { contains: ed.counterparty, mode: "insensitive" } },
          { supplierNameRaw: { contains: ed.counterparty, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!matchingDoc) {
      const expectedDate = new Date(now.getFullYear(), now.getMonth(), 15);
      const daysPastDue = Math.max(0, Math.floor((now.getTime() - expectedDate.getTime()) / 86400000));
      missingDocuments.push({
        id: ed.id,
        description: ed.name,
        expectedDate: expectedDate.toISOString(),
        supplierName: ed.counterparty,
        daysPastDue,
      });
    }
  }

  // Upcoming deadlines
  const upcomingDeadlines: Array<{
    type: "contract" | "vat" | "period" | "task";
    title: string; dueDate: string; daysRemaining: number;
  }> = [];

  for (const c of contracts) {
    if (c.endDate) {
      upcomingDeadlines.push({
        type: "contract",
        title: c.name,
        dueDate: c.endDate.toISOString(),
        daysRemaining: Math.ceil((c.endDate.getTime() - now.getTime()) / 86400000),
      });
    }
  }

  // Draft VAT returns as deadlines
  const draftVat = await prisma.vatReturn.findMany({
    where: { companyId, status: "draft" },
    select: { quarter: true, year: true },
    take: 3,
  });
  for (const vr of draftVat) {
    const qEnd = new Date(vr.year, vr.quarter * 3, 0);
    const deadlineDate = new Date(qEnd.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days after quarter end
    upcomingDeadlines.push({
      type: "vat",
      title: `MwSt Q${vr.quarter}/${vr.year}`,
      dueDate: deadlineDate.toISOString(),
      daysRemaining: Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000),
    });
  }

  // Task deadlines
  for (const t of openTasks.filter((t) => t.dueDate)) {
    const due = new Date(t.dueDate!);
    if (due <= thirtyDaysFromNow) {
      upcomingDeadlines.push({
        type: "task",
        title: t.title,
        dueDate: due.toISOString(),
        daysRemaining: Math.ceil((due.getTime() - now.getTime()) / 86400000),
      });
    }
  }

  upcomingDeadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);

  // Document status counts
  const statusMap: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    statusMap[row.status] = row._count;
    total += row._count;
  }

  // Recent activity
  const actionLabels: Record<string, string> = {
    document_uploaded: "Beleg hochgeladen",
    document_approved: "Beleg genehmigt",
    document_rejected: "Beleg abgelehnt",
    document_exported: "Beleg exportiert",
    period_status_changed: "Periodenstatus geändert",
    period_locked: "Periode gesperrt",
    task_created: "Aufgabe erstellt",
    supplier_created: "Lieferant angelegt",
  };

  const recentActivity = recentLogs.map((log) => ({
    type: log.action,
    description: actionLabels[log.action] || log.action,
    timestamp: log.createdAt.toISOString(),
  }));

  return NextResponse.json({
    company: { name: company?.name || "—", status: company?.status || "active" },
    openTasks: openTasks.map((t) => ({
      id: t.id, title: t.title, priority: t.priority,
      dueDate: t.dueDate?.toISOString() || null, taskType: t.taskType,
    })),
    missingDocuments,
    upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    documentStatus: {
      uploaded: statusMap.uploaded || 0,
      processing: statusMap.processing || 0,
      needsReview: statusMap.needs_review || 0,
      ready: (statusMap.ready || 0) + (statusMap.exported || 0),
      exported: statusMap.exported || 0,
      total,
    },
    recentActivity,
  });
}
