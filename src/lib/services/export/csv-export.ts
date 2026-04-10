import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

const CSV_HEADERS = [
  "Belegnummer",
  "Lieferant",
  "Rechnungsnr.",
  "Rechnungsdatum",
  "Fälligkeitsdatum",
  "Währung",
  "Netto",
  "MwSt",
  "Brutto",
  "MwSt-Satz",
  "Kategorie",
  "Kontonummer",
  "Kostenstelle",
  "IBAN",
  "Zahlungsreferenz",
  "Status",
];

function formatDateDE(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function formatNumberDE(n: number | null): string {
  if (n == null) return "";
  return n.toFixed(2).replace(".", ",");
}

function escCsv(v: string): string {
  if (v.includes(";") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export interface ExportWarning {
  documentId: string;
  documentNumber: string;
  warning: string;
}

export async function generateCsvExport(
  companyId: string,
  userId: string,
  documentIds: string[],
  separator: string = ";"
): Promise<{ batchId: string; csv: string; count: number; warnings: ExportWarning[] }> {
  const batchId = uuidv4();

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds }, companyId },
    include: { supplier: { select: { nameNormalized: true } } },
  });

  const readyDocs = documents.filter((d) => d.status === "ready");
  if (readyDocs.length === 0) {
    throw new Error("Keine bereiten Belege zum Exportieren");
  }

  // Load chart of accounts for validation
  const chartAccounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: { accountNumber: true },
  });
  const accountSet = new Set(chartAccounts.map((a) => a.accountNumber));
  const hasChart = chartAccounts.length > 0;

  const warnings: ExportWarning[] = [];

  // Build CSV
  const sep = separator;
  const rows: string[] = [
    "\uFEFF" + CSV_HEADERS.join(sep), // BOM for Excel
  ];

  for (const doc of readyDocs) {
    // Check accountCode against chart of accounts
    const docWarning =
      hasChart && doc.accountCode && !accountSet.has(doc.accountCode)
        ? `Konto ${doc.accountCode} ist nicht im Kontenplan`
        : null;

    if (docWarning) {
      warnings.push({
        documentId: doc.id,
        documentNumber: doc.documentNumber || doc.id.slice(0, 8),
        warning: docWarning,
      });
    }

    const vatRates = (doc.vatRatesDetected as any[]) || [];
    const vatRateStr = vatRates.map((r) => `${r.rate}%`).join(", ");

    const row = [
      escCsv(doc.documentNumber || ""),
      escCsv(doc.supplier?.nameNormalized || doc.supplierNameNormalized || doc.supplierNameRaw || ""),
      escCsv(doc.invoiceNumber || ""),
      formatDateDE(doc.invoiceDate),
      formatDateDE(doc.dueDate),
      doc.currency || "",
      formatNumberDE(doc.netAmount ? Number(doc.netAmount) : null),
      formatNumberDE(doc.vatAmount ? Number(doc.vatAmount) : null),
      formatNumberDE(doc.grossAmount ? Number(doc.grossAmount) : null),
      escCsv(vatRateStr),
      escCsv(doc.expenseCategory || ""),
      escCsv(doc.accountCode || ""),
      escCsv(doc.costCenter || ""),
      escCsv(doc.iban || ""),
      escCsv(doc.paymentReference || ""),
      doc.status,
    ];
    rows.push(row.join(sep));

    // Create export record (with warning if applicable)
    await prisma.exportRecord.create({
      data: {
        documentId: doc.id,
        exportTarget: "csv",
        status: "success",
        externalId: batchId,
        ...(docWarning && { errorMessage: docWarning }),
      },
    });

    // Update document export status
    await prisma.document.update({
      where: { id: doc.id },
      data: { exportStatus: "exported" },
    });
  }

  return { batchId, csv: rows.join("\r\n"), count: readyDocs.length, warnings };
}
