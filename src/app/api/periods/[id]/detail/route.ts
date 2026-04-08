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
    expectedDocuments,
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
    // 8. Expected documents
    prisma.expectedDocument.findMany({
      where: { companyId, isActive: true },
    }),
  ]);

  // Check expected documents for this month
  const expectedDocsResults: { name: string; counterparty: string; expectedAmount: any; status: string }[] = [];
  let expReceived = 0, expMissing = 0, expMismatch = 0;

  for (const ed of expectedDocuments) {
    const isExpected = checkExpectedThisMonth(ed.frequency, month, ed.createdAt);
    if (!isExpected) continue;

    const matchedDoc = await prisma.document.findFirst({
      where: {
        companyId,
        invoiceDate: { gte: monthStart, lt: monthEnd },
        OR: [
          { supplierNameNormalized: { contains: ed.counterparty, mode: "insensitive" } },
          { supplierNameRaw: { contains: ed.counterparty, mode: "insensitive" } },
        ],
      },
      select: { id: true, grossAmount: true },
    });

    if (!matchedDoc) {
      expectedDocsResults.push({ name: ed.name, counterparty: ed.counterparty, expectedAmount: ed.expectedAmount, status: "missing" });
      expMissing++;
    } else if (ed.expectedAmount && matchedDoc.grossAmount) {
      const actual = Number(matchedDoc.grossAmount);
      const expected = Number(ed.expectedAmount);
      const tolerance = (ed.tolerancePercent ?? 20) / 100;
      if (Math.abs(actual - expected) > expected * tolerance) {
        expectedDocsResults.push({ name: ed.name, counterparty: ed.counterparty, expectedAmount: ed.expectedAmount, status: "amount_mismatch" });
        expMismatch++;
      } else {
        expectedDocsResults.push({ name: ed.name, counterparty: ed.counterparty, expectedAmount: ed.expectedAmount, status: "received" });
        expReceived++;
      }
    } else {
      expectedDocsResults.push({ name: ed.name, counterparty: ed.counterparty, expectedAmount: ed.expectedAmount, status: "received" });
      expReceived++;
    }
  }

  // Fallback: also check contracts (for companies that haven't set up expected docs yet)
  const missingContractDocs: { contractName: string; counterparty: string }[] = [];
  if (expectedDocuments.length === 0) {
    for (const c of contracts) {
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
  }

  const expTotal = expReceived + expMissing + expMismatch;
  const docsComplete = expectedDocuments.length > 0 ? expMissing === 0 : missingContractDocs.length === 0;
  const docsDetail = expectedDocuments.length > 0
    ? (expMissing > 0 ? `${expMissing} fehlen` : null)
    : (missingContractDocs.length > 0 ? `${missingContractDocs.length} fehlen` : null);

  // Build checklist
  const checklist = [
    { key: "all_docs_ready", label: "Alle Belege geprüft", done: totalDocs > 0 && needsReviewDocs === 0 && failedDocs === 0, detail: `${readyDocs}/${totalDocs} bereit` },
    { key: "no_escalations", label: "Keine offenen Eskalationen", done: escalatedDocs === 0, detail: escalatedDocs > 0 ? `${escalatedDocs} eskaliert` : null },
    { key: "recurring_generated", label: "Wiederkehrende Buchungen erzeugt", done: activeRecurring === 0 || recurringEntries >= activeRecurring, detail: `${recurringEntries}/${activeRecurring}` },
    { key: "depreciation_done", label: "Abschreibungen erzeugt", done: activeAssets === 0 || depreciationEntries >= activeAssets, detail: `${depreciationEntries}/${activeAssets}` },
    { key: "expected_complete", label: "Erwartete Unterlagen vollständig", done: docsComplete, detail: docsDetail },
    { key: "tasks_cleared", label: "Alle Pendenzen erledigt", done: openTasks.length === 0, detail: openTasks.length > 0 ? `${openTasks.length} offen` : null },
    { key: "exported", label: "Export durchgeführt", done: exportedDocs > 0 || totalDocs === 0, detail: `${exportedDocs} exportiert` },
  ];

  const blockers = checklist.filter((c) => !c.done).map((c) => c.label);

  return NextResponse.json({
    period,
    checklist,
    blockers,
    missingContractDocs,
    expectedDocs: { total: expTotal, received: expReceived, missing: expMissing, mismatch: expMismatch, details: expectedDocsResults },
    openTasks,
    stats: { totalDocs, readyDocs, needsReviewDocs, failedDocs, exportedDocs },
  });
}

function checkExpectedThisMonth(frequency: string, month: number, createdAt: Date): boolean {
  if (frequency === "monthly") return true;
  if (frequency === "quarterly") return month % 3 === 1;
  if (frequency === "yearly") return createdAt.getMonth() + 1 === month;
  return true;
}
