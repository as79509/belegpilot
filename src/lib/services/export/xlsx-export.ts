import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import ExcelJS from "exceljs";

interface ColumnDef {
  key: string;
  header: string;
  getValue: (doc: any) => any;
  isNumber?: boolean;
}

function formatDateDE(d: Date | null): string {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "documentNumber", header: "Belegnummer", getValue: (d) => d.documentNumber || "" },
  { key: "supplier", header: "Lieferant", getValue: (d) => d.supplier?.nameNormalized || d.supplierNameNormalized || d.supplierNameRaw || "" },
  { key: "invoiceNumber", header: "Rechnungsnr.", getValue: (d) => d.invoiceNumber || "" },
  { key: "invoiceDate", header: "Rechnungsdatum", getValue: (d) => formatDateDE(d.invoiceDate) },
  { key: "dueDate", header: "Fälligkeitsdatum", getValue: (d) => formatDateDE(d.dueDate) },
  { key: "currency", header: "Währung", getValue: (d) => d.currency || "" },
  { key: "netAmount", header: "Netto", getValue: (d) => d.netAmount ? Number(d.netAmount) : null, isNumber: true },
  { key: "vatAmount", header: "MwSt", getValue: (d) => d.vatAmount ? Number(d.vatAmount) : null, isNumber: true },
  { key: "grossAmount", header: "Brutto", getValue: (d) => d.grossAmount ? Number(d.grossAmount) : null, isNumber: true },
  { key: "vatRates", header: "MwSt-Satz", getValue: (d) => ((d.vatRatesDetected as any[]) || []).map((r: any) => `${r.rate}%`).join(", ") },
  { key: "category", header: "Kategorie", getValue: (d) => d.expenseCategory || "" },
  { key: "accountCode", header: "Kontonummer", getValue: (d) => d.accountCode || "" },
  { key: "costCenter", header: "Kostenstelle", getValue: (d) => d.costCenter || "" },
  { key: "iban", header: "IBAN", getValue: (d) => d.iban || "" },
  { key: "paymentReference", header: "Zahlungsreferenz", getValue: (d) => d.paymentReference || "" },
];

export async function generateXlsxExport(
  companyId: string,
  userId: string,
  documentIds: string[],
  selectedColumns?: string[]
): Promise<{ batchId: string; buffer: Buffer; count: number }> {
  const batchId = uuidv4();

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds }, companyId, status: "ready" },
    include: { supplier: { select: { nameNormalized: true } } },
    orderBy: { documentNumber: "asc" },
  });

  if (!documents.length) throw new Error("Keine bereiten Belege");

  // Filter columns
  const columns = selectedColumns?.length
    ? ALL_COLUMNS.filter((c) => selectedColumns.includes(c.key))
    : ALL_COLUMNS;

  const workbook = new ExcelJS.Workbook();

  // Data sheet
  const sheet = workbook.addWorksheet("Belege");

  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

  let totalGross = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const doc of documents) {
    sheet.addRow(columns.map((c) => c.getValue(doc)));

    if (doc.grossAmount) totalGross += Number(doc.grossAmount);
    if (doc.invoiceDate) {
      if (!minDate || doc.invoiceDate < minDate) minDate = doc.invoiceDate;
      if (!maxDate || doc.invoiceDate > maxDate) maxDate = doc.invoiceDate;
    }

    await prisma.exportRecord.create({
      data: { documentId: doc.id, exportTarget: "xlsx", status: "success", externalId: batchId },
    });
    await prisma.document.update({
      where: { id: doc.id },
      data: { exportStatus: "exported" },
    });
  }

  // Format number columns
  columns.forEach((col, idx) => {
    if (col.isNumber) {
      sheet.getColumn(idx + 1).numFmt = "#,##0.00";
    }
  });

  // Auto-width
  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  // Summary sheet
  const summary = workbook.addWorksheet("Zusammenfassung");
  summary.addRow(["Zusammenfassung"]).font = { bold: true, size: 14 };
  summary.addRow([]);
  summary.addRow(["Anzahl Belege", documents.length]);
  summary.addRow(["Gesamtbetrag", totalGross]);
  summary.addRow(["Exportdatum", formatDateDE(new Date())]);
  if (minDate && maxDate) {
    summary.addRow(["Zeitraum", `${formatDateDE(minDate)} – ${formatDateDE(maxDate)}`]);
  }
  summary.getColumn(1).width = 20;
  summary.getColumn(2).width = 30;
  summary.getRow(4).getCell(2).numFmt = "#,##0.00";

  const arrayBuffer = await workbook.xlsx.writeBuffer();

  return { batchId, buffer: Buffer.from(arrayBuffer), count: documents.length };
}
