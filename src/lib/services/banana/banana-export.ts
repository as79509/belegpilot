import { prisma } from "@/lib/db";

export interface BananaExportOptions {
  companyId: string;
  year: number;
  month: number;
  includeBlocked?: boolean;
  format?: "csv" | "tsv";
}

export interface BananaExportResult {
  success: boolean;
  data: string;
  filename: string;
  exportedCount: number;
  skippedCount: number;
  warnings: string[];
  exportRecordId: string;
}

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function formatAmount(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return num.toFixed(2);
}

export async function generateBananaExport(options: BananaExportOptions): Promise<BananaExportResult> {
  const { companyId, year, month, includeBlocked = false, format = "csv" } = options;
  const sep = format === "tsv" ? "\t" : ";";

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // Load all journal entries for the month
  const entries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      entryDate: { gte: startDate, lt: endDate },
    },
    include: {
      document: { select: { id: true, documentNumber: true, invoiceNumber: true } },
    },
    orderBy: { entryDate: "asc" },
  });

  // Load account mappings
  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: { accountNumber: true, bananaAccountNumber: true, bananaMappingStatus: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.accountNumber, a]));

  // Load VAT code mappings
  const vatMappings = await prisma.vatCodeMapping.findMany({
    where: { companyId, mappingStatus: "mapped" },
    select: { internalRate: true, bananaVatCode: true, isDefault: true },
  });
  const vatMap = new Map<number, string>();
  // Prefer default codes; fill others as fallback
  for (const v of vatMappings) {
    if (v.bananaVatCode && (v.isDefault || !vatMap.has(v.internalRate))) {
      vatMap.set(v.internalRate, v.bananaVatCode);
    }
  }

  const warnings: string[] = [];
  const exportRows: string[] = [];
  let exportedCount = 0;
  let skippedCount = 0;
  const exportedDocumentIds: string[] = [];

  // CSV header
  exportRows.push(["Date", "Doc", "Description", "AccountDebit", "AccountCredit", "Amount", "VatCode", "VatAmount"].join(sep));

  for (const entry of entries) {
    const debitAcc = accountMap.get(entry.debitAccount);
    const creditAcc = accountMap.get(entry.creditAccount);
    const amount = Number(entry.amount);

    const debitMapped = debitAcc?.bananaAccountNumber && debitAcc.bananaMappingStatus === "mapped";
    const creditMapped = creditAcc?.bananaAccountNumber && creditAcc.bananaMappingStatus === "mapped";
    const vatMapped = entry.vatRate == null || entry.vatRate === 0 || vatMap.has(entry.vatRate);
    const isComplete = amount > 0;

    const isReady = debitMapped && creditMapped && vatMapped && isComplete;

    if (!isReady && !includeBlocked) {
      skippedCount++;
      continue;
    }

    if (!isReady) {
      warnings.push(`Buchung ${entry.id} teilweise ungemappt — mit Fallback exportiert`);
    }

    const bananaDebit = debitAcc?.bananaAccountNumber || entry.debitAccount;
    const bananaCredit = creditAcc?.bananaAccountNumber || entry.creditAccount;
    const bananaVatCode = entry.vatRate != null && entry.vatRate > 0
      ? (vatMap.get(entry.vatRate) || "")
      : "";
    const vatAmount = entry.vatAmount != null ? formatAmount(Number(entry.vatAmount)) : "0.00";
    const docRef = entry.reference || entry.document?.documentNumber || entry.document?.invoiceNumber || "";

    // Escape description: remove semicolons/tabs to avoid CSV corruption
    const desc = entry.description.replace(/[;\t\r\n]/g, " ").trim();

    exportRows.push([
      formatDate(entry.entryDate),
      docRef,
      desc,
      bananaDebit,
      bananaCredit,
      formatAmount(amount),
      bananaVatCode,
      vatAmount,
    ].join(sep));

    exportedCount++;
    if (entry.documentId) exportedDocumentIds.push(entry.documentId);
  }

  const data = exportRows.join("\r\n") + "\r\n";
  const monthStr = month.toString().padStart(2, "0");
  const filename = `banana-export-${year}-${monthStr}.${format}`;

  // Create ExportRecord for the first exported document (or a placeholder)
  const firstDocId = exportedDocumentIds[0];
  let exportRecordId = "";

  if (firstDocId) {
    const record = await prisma.exportRecord.create({
      data: {
        documentId: firstDocId,
        exportTarget: "banana",
        status: "completed",
        payloadSent: {
          year,
          month,
          exportedCount,
          skippedCount,
          format,
        },
      },
    });
    exportRecordId = record.id;

    // Update exportStatus for exported documents
    const uniqueDocIds = [...new Set(exportedDocumentIds)];
    if (uniqueDocIds.length > 0) {
      await prisma.document.updateMany({
        where: { id: { in: uniqueDocIds } },
        data: { exportStatus: "exported" },
      });
    }
  }

  return {
    success: true,
    data,
    filename,
    exportedCount,
    skippedCount,
    warnings,
    exportRecordId,
  };
}
