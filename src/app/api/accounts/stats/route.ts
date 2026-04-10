import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const companyId = ctx.companyId;

  // Load all active accounts
  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { accountNumber: "asc" }],
    take: 200,
  });

  // Parallel aggregation queries
  const [docCounts, journalDebits, journalCredits, suggestionCounts, correctionCounts, lastUsedDocs] =
    await Promise.all([
      // Documents per accountCode
      prisma.document.groupBy({
        by: ["accountCode"],
        where: { companyId, accountCode: { not: null } },
        _count: { id: true },
      }),
      // JournalEntries where account is debit
      prisma.journalEntry.groupBy({
        by: ["debitAccount"],
        where: { companyId },
        _count: { id: true },
      }),
      // JournalEntries where account is credit
      prisma.journalEntry.groupBy({
        by: ["creditAccount"],
        where: { companyId },
        _count: { id: true },
      }),
      // BookingSuggestions per suggestedAccount
      prisma.bookingSuggestion.groupBy({
        by: ["suggestedAccount"],
        where: { companyId, suggestedAccount: { not: null } },
        _count: { id: true },
      }),
      // CorrectionEvents where field=accountCode, grouped by correctedValue
      prisma.correctionEvent.groupBy({
        by: ["correctedValue"],
        where: { companyId, field: "accountCode" },
        _count: { id: true },
      }),
      // Last used document date per accountCode
      prisma.document.groupBy({
        by: ["accountCode"],
        where: { companyId, accountCode: { not: null } },
        _max: { invoiceDate: true },
      }),
    ]);

  // Build lookup maps
  const docCountMap: Record<string, number> = {};
  for (const r of docCounts) {
    if (r.accountCode) docCountMap[r.accountCode] = r._count.id;
  }

  const journalCountMap: Record<string, number> = {};
  for (const r of journalDebits) {
    journalCountMap[r.debitAccount] = (journalCountMap[r.debitAccount] || 0) + r._count.id;
  }
  for (const r of journalCredits) {
    journalCountMap[r.creditAccount] = (journalCountMap[r.creditAccount] || 0) + r._count.id;
  }

  const suggestionMap: Record<string, number> = {};
  for (const r of suggestionCounts) {
    if (r.suggestedAccount) suggestionMap[r.suggestedAccount] = r._count.id;
  }

  const correctionMap: Record<string, number> = {};
  for (const r of correctionCounts) {
    correctionMap[r.correctedValue] = r._count.id;
  }

  const lastUsedMap: Record<string, string | null> = {};
  for (const r of lastUsedDocs) {
    if (r.accountCode) {
      lastUsedMap[r.accountCode] = r._max.invoiceDate
        ? r._max.invoiceDate.toISOString()
        : null;
    }
  }

  // Build response
  const result = accounts.map((acc) => ({
    accountNumber: acc.accountNumber,
    name: acc.name,
    accountType: acc.accountType,
    aiGovernance: acc.aiGovernance,
    documentCount: docCountMap[acc.accountNumber] || 0,
    journalCount: journalCountMap[acc.accountNumber] || 0,
    suggestionCount: suggestionMap[acc.accountNumber] || 0,
    correctionCount: correctionMap[acc.accountNumber] || 0,
    lastUsedAt: lastUsedMap[acc.accountNumber] || null,
  }));

  return NextResponse.json({ accounts: result });
}
