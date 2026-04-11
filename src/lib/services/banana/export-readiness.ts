import { prisma } from "@/lib/db";

export interface ExportReadinessResult {
  ready: number;
  blocked: number;
  total: number;
  readyRate: number;
  issues: Array<{
    journalEntryId: string;
    entryDate: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    reason: string;
    severity: "error";
  }>;
  topBlockReasons: Array<{ reason: string; count: number }>;
}

export async function checkExportReadiness(
  companyId: string,
  year: number,
  month: number
): Promise<ExportReadinessResult> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // Load journal entries for the month
  const entries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      entryDate: { gte: startDate, lt: endDate },
    },
    orderBy: { entryDate: "asc" },
  });

  if (entries.length === 0) {
    return { ready: 0, blocked: 0, total: 0, readyRate: 0, issues: [], topBlockReasons: [] };
  }

  // Load all active accounts with banana mapping for the company
  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: { accountNumber: true, bananaAccountNumber: true, bananaMappingStatus: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.accountNumber, a]));

  // Load all mapped VAT codes for the company
  const vatMappings = await prisma.vatCodeMapping.findMany({
    where: { companyId },
    select: { internalRate: true, mappingStatus: true },
  });
  const vatMappedRates = new Set(
    vatMappings.filter((v) => v.mappingStatus === "mapped").map((v) => v.internalRate)
  );

  const issues: ExportReadinessResult["issues"] = [];
  let ready = 0;
  let blocked = 0;

  for (const entry of entries) {
    const entryIssues: string[] = [];
    const amount = Number(entry.amount);

    // Check debit account mapping
    const debitAcc = accountMap.get(entry.debitAccount);
    if (!debitAcc || !debitAcc.bananaAccountNumber || debitAcc.bananaMappingStatus !== "mapped") {
      entryIssues.push("debit_account_unmapped");
    }

    // Check credit account mapping
    const creditAcc = accountMap.get(entry.creditAccount);
    if (!creditAcc || !creditAcc.bananaAccountNumber || creditAcc.bananaMappingStatus !== "mapped") {
      entryIssues.push("credit_account_unmapped");
    }

    // Check VAT code mapping (if entry has a VAT rate)
    if (entry.vatRate != null && entry.vatRate > 0) {
      if (!vatMappedRates.has(entry.vatRate)) {
        entryIssues.push("vat_code_unmapped");
      }
    }

    // Check amount
    if (!amount || amount <= 0) {
      entryIssues.push("entry_incomplete");
    }

    if (entryIssues.length === 0) {
      ready++;
    } else {
      blocked++;
      for (const reason of entryIssues) {
        issues.push({
          journalEntryId: entry.id,
          entryDate: entry.entryDate.toISOString().split("T")[0],
          description: entry.description,
          debitAccount: entry.debitAccount,
          creditAccount: entry.creditAccount,
          amount,
          reason,
          severity: "error",
        });
      }
    }
  }

  // Group issues by reason → topBlockReasons
  const reasonCounts: Record<string, number> = {};
  for (const issue of issues) {
    reasonCounts[issue.reason] = (reasonCounts[issue.reason] || 0) + 1;
  }
  const topBlockReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const total = entries.length;
  const readyRate = total > 0 ? ready / total : 0;

  return { ready, blocked, total, readyRate, issues, topBlockReasons };
}
