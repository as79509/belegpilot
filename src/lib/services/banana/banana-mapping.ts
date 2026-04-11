import { prisma } from "@/lib/db";

export interface MappingOverview {
  accounts: {
    total: number;
    mapped: number;
    unmapped: number;
    uncertain: number;
    blocked: number;
    mappingRate: number;
  };
  vatCodes: {
    total: number;
    mapped: number;
    unmapped: number;
    uncertain: number;
    mappingRate: number;
  };
  exportReady: boolean;
  issues: Array<{
    type: "account_unmapped" | "account_uncertain" | "vat_unmapped" | "vat_uncertain";
    message: string;
    accountNumber?: string;
    rate?: number;
    severity: "error" | "warning";
  }>;
}

export async function getMappingOverview(companyId: string): Promise<MappingOverview> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Count accounts by bananaMappingStatus
  const [accountCounts, vatCounts, recentlyUsedUnmapped, uncertainAccounts, unmappedVat, uncertainVat] = await Promise.all([
    prisma.account.groupBy({
      by: ["bananaMappingStatus"],
      where: { companyId, isActive: true },
      _count: true,
    }),
    prisma.vatCodeMapping.groupBy({
      by: ["mappingStatus"],
      where: { companyId },
      _count: true,
    }),
    // Accounts without mapping that were used in last 90 days (via journal entries)
    prisma.$queryRaw<Array<{ account_number: string; name: string }>>`
      SELECT DISTINCT a.account_number, a.name
      FROM accounts a
      INNER JOIN journal_entries je ON je.company_id = a.company_id
        AND (je.debit_account = a.account_number OR je.credit_account = a.account_number)
        AND je.created_at >= ${ninetyDaysAgo}
      WHERE a.company_id = ${companyId}::uuid
        AND a.is_active = true
        AND a.banana_mapping_status = 'unmapped'
    `,
    // Uncertain accounts
    prisma.account.findMany({
      where: { companyId, isActive: true, bananaMappingStatus: "uncertain" },
      select: { accountNumber: true, name: true },
    }),
    // Unmapped VAT codes
    prisma.vatCodeMapping.findMany({
      where: { companyId, mappingStatus: "unmapped" },
      select: { internalRate: true, internalLabel: true },
    }),
    // Uncertain VAT codes
    prisma.vatCodeMapping.findMany({
      where: { companyId, mappingStatus: "uncertain" },
      select: { internalRate: true, internalLabel: true },
    }),
  ]);

  // Parse account counts
  const acctMap: Record<string, number> = {};
  let accountTotal = 0;
  for (const row of accountCounts) {
    acctMap[row.bananaMappingStatus] = row._count;
    accountTotal += row._count;
  }
  const accountMapped = acctMap["mapped"] ?? 0;
  const accountUnmapped = acctMap["unmapped"] ?? 0;
  const accountUncertain = acctMap["uncertain"] ?? 0;
  const accountBlocked = acctMap["blocked"] ?? 0;
  const accountMappingRate = accountTotal > 0 ? accountMapped / accountTotal : 0;

  // Parse VAT counts
  const vatMap: Record<string, number> = {};
  let vatTotal = 0;
  for (const row of vatCounts) {
    vatMap[row.mappingStatus] = row._count;
    vatTotal += row._count;
  }
  const vatMapped = vatMap["mapped"] ?? 0;
  const vatUnmapped = vatMap["unmapped"] ?? 0;
  const vatUncertain = vatMap["uncertain"] ?? 0;
  const vatMappingRate = vatTotal > 0 ? vatMapped / vatTotal : 0;

  // Collect issues
  const issues: MappingOverview["issues"] = [];

  for (const acc of recentlyUsedUnmapped) {
    issues.push({
      type: "account_unmapped",
      message: `Konto ${acc.account_number} (${acc.name}) hat kein Banana-Mapping`,
      accountNumber: acc.account_number,
      severity: "error",
    });
  }

  for (const acc of uncertainAccounts) {
    issues.push({
      type: "account_uncertain",
      message: `Konto ${acc.accountNumber} (${acc.name}) — Mapping unsicher, bitte prüfen`,
      accountNumber: acc.accountNumber,
      severity: "warning",
    });
  }

  for (const vat of unmappedVat) {
    issues.push({
      type: "vat_unmapped",
      message: `MwSt-Satz ${vat.internalRate}% (${vat.internalLabel}) hat keinen Banana-Code`,
      rate: vat.internalRate,
      severity: "error",
    });
  }

  for (const vat of uncertainVat) {
    issues.push({
      type: "vat_uncertain",
      message: `MwSt-Satz ${vat.internalRate}% (${vat.internalLabel}) — Banana-Code unsicher`,
      rate: vat.internalRate,
      severity: "warning",
    });
  }

  const exportReady = accountMappingRate >= 0.9 && vatMappingRate >= 1.0;

  return {
    accounts: {
      total: accountTotal,
      mapped: accountMapped,
      unmapped: accountUnmapped,
      uncertain: accountUncertain,
      blocked: accountBlocked,
      mappingRate: accountMappingRate,
    },
    vatCodes: {
      total: vatTotal,
      mapped: vatMapped,
      unmapped: vatUnmapped,
      uncertain: vatUncertain,
      mappingRate: vatMappingRate,
    },
    exportReady,
    issues,
  };
}
