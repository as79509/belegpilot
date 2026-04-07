import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import ExcelJS from "exceljs";

function formatDateDE(d: Date | null): string {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateXlsxExport(
  companyId: string,
  userId: string,
  documentIds: string[],
  columns?: string[]
): Promise<{ batchId: string; buffer: Buffer; count: number }> {
  const batchId = uuidv4();

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds }, companyId, status: "ready" },
    include: { supplier: { select: { nameNormalized: true } } },
    orderBy: { documentNumber: "asc" },
  });

  if (!documents.length) throw new Error("Keine bereiten Belege");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Belege");

  // Headers
  const headers = [
    "Belegnummer", "Lieferant", "Rechnungsnr.", "Rechnungsdatum",
    "Fälligkeitsdatum", "Währung", "Netto", "MwSt", "Brutto",
    "MwSt-Satz", "Kategorie", "Kontonummer", "Kostenstelle", "IBAN", "Zahlungsreferenz",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Data rows
  for (const doc of documents) {
    const vatRates = (doc.vatRatesDetected as any[]) || [];
    const vatRateStr = vatRates.map((r) => `${r.rate}%`).join(", ");

    sheet.addRow([
      doc.documentNumber || "",
      doc.supplier?.nameNormalized || doc.supplierNameNormalized || doc.supplierNameRaw || "",
      doc.invoiceNumber || "",
      formatDateDE(doc.invoiceDate),
      formatDateDE(doc.dueDate),
      doc.currency || "",
      doc.netAmount ? Number(doc.netAmount) : null,
      doc.vatAmount ? Number(doc.vatAmount) : null,
      doc.grossAmount ? Number(doc.grossAmount) : null,
      vatRateStr,
      doc.expenseCategory || "",
      doc.accountCode || "",
      doc.costCenter || "",
      doc.iban || "",
      doc.paymentReference || "",
    ]);

    // Create export record
    await prisma.exportRecord.create({
      data: { documentId: doc.id, exportTarget: "xlsx", status: "success", externalId: batchId },
    });
    await prisma.document.update({
      where: { id: doc.id },
      data: { exportStatus: "exported" },
    });
  }

  // Format amount columns as numbers
  [7, 8, 9].forEach((col) => {
    sheet.getColumn(col).numFmt = '#,##0.00';
  });

  // Auto-width columns
  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  console.log(`[XLSX Export] ${documents.length} documents exported`);

  return {
    batchId,
    buffer: Buffer.from(arrayBuffer),
    count: documents.length,
  };
}
