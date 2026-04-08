import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;
  const { id } = await params;

  // Load period — id can be a UUID or "year-month" format
  let period: any;
  if (id.includes("-") && id.length <= 7) {
    const [yearStr, monthStr] = id.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    period = await prisma.monthlyPeriod.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    if (!period) {
      period = { id: null, companyId, year, month, status: "open", notes: null };
    }
  } else {
    period = await prisma.monthlyPeriod.findFirst({
      where: { id, companyId },
    });
    if (!period) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const { year, month } = period;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  // Run all queries in parallel
  const [
    totalDocs,
    readyDocs,
    needsReviewDocs,
    failedDocs,
    exportedDocs,
    recurringEntries,
    activeRecurring,
    depreciationEntries,
    activeAssets,
    openTasks,
    escalatedDocs,
    contracts,
  ] = await Promise.all([
    // 1. Document completeness
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: { in: ["ready", "exported"] } },
    }),
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: "needs_review" },
    }),
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: "failed" },
    }),
    // 7. Export status
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, exportStatus: "exported" },
    }),
    // 2. Recurring entries
    prisma.journalEntry.count({
      where: { companyId, entryDate: { gte: monthStart, lt: monthEnd }, isRecurring: true },
    }),
    prisma.recurringEntry.count({
      where: { companyId, isActive: true },
    }),
    // 3. Depreciation
    prisma.journalEntry.count({
      where: { companyId, entryDate: { gte: monthStart, lt: monthEnd }, entryType: "depreciation" },
    }),
    prisma.asset.count({
      where: { companyId, status: "active" },
    }),
    // 4. Open tasks
    prisma.task.findMany({
      where: { companyId, status: { in: ["open", "in_progress"] } },
      select: { id: true, title: true, taskType: true, priority: true, status: true },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    // 5. Escalated docs
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: "needs_review", decisionReasons: { not: null as any } },
    }),
    // 6. Active contracts
    prisma.contract.findMany({
      where: { companyId, status: { in: ["active", "expiring"] } },
      select: { id: true, name: true, counterparty: true, frequency: true, startDate: true },
    }),
  ]);

  // Check missing contract documents for this month
  const missingContractDocs: { contractName: string; counterparty: string }[] = [];
  for (const c of contracts) {
    // Only monthly contracts expected every month
    if (c.frequency !== "monthly") continue;
    const matchingDoc = await prisma.document.findFirst({
      where: {
        companyId,
        supplierNameNormalized: { contains: c.counterparty, mode: "insensitive" },
        invoiceDate: { gte: monthStart, lt: monthEnd },
      },
      select: { id: true },
    });
    if (!matchingDoc) {
      missingContractDocs.push({ contractName: c.name, counterparty: c.counterparty });
    }
  }

  // Build checklist
  const checklist = [
    { key: "all_docs_ready", label: "Alle Belege geprüft", done: totalDocs > 0 && needsReviewDocs === 0 && failedDocs === 0, detail: `${readyDocs}/${totalDocs} bereit` },
    { key: "no_escalations", label: "Keine offenen Eskalationen", done: escalatedDocs === 0, detail: escalatedDocs > 0 ? `${escalatedDocs} eskaliert` : null },
    { key: "recurring_generated", label: "Wiederkehrende Buchungen erzeugt", done: activeRecurring === 0 || recurringEntries >= activeRecurring, detail: `${recurringEntries}/${activeRecurring}` },
    { key: "depreciation_done", label: "Abschreibungen erzeugt", done: activeAssets === 0 || depreciationEntries >= activeAssets, detail: `${depreciationEntries}/${activeAssets}` },
    { key: "contracts_complete", label: "Standardbelege vollständig", done: missingContractDocs.length === 0, detail: missingContractDocs.length > 0 ? `${missingContractDocs.length} fehlen` : null },
    { key: "tasks_cleared", label: "Alle Pendenzen erledigt", done: openTasks.length === 0, detail: openTasks.length > 0 ? `${openTasks.length} offen` : null },
    { key: "exported", label: "Export durchgeführt", done: exportedDocs > 0 || totalDocs === 0, detail: `${exportedDocs} exportiert` },
  ];

  const blockers = checklist.filter((c) => !c.done).map((c) => c.label);

  return NextResponse.json({
    period,
    checklist,
    blockers,
    missingContractDocs,
    openTasks,
    stats: { totalDocs, readyDocs, needsReviewDocs, failedDocs, exportedDocs },
  });
}
