import { format } from "date-fns";

import { resolvePostingDate } from "@/lib/utils";

type ExportDocument = {
  id: string;
  status: string;
  documentDate: Date | null;
  invoiceDate: Date | null;
  invoiceNumber: string | null;
  description: string | null;
  supplierName: string | null;
  grossAmount: number | null;
  confirmedExpenseAccountNo: string | null;
  suggestedExpenseAccountNo: string | null;
  creditAccountNo: string | null;
  externalReference: string;
  createdAt: Date;
};

export function isExportableDocument(document: ExportDocument, onlyReviewed: boolean) {
  if (onlyReviewed && document.status !== "geprueft" && document.status !== "exportiert") {
    return false;
  }

  return Boolean(
    document.grossAmount &&
      document.grossAmount > 0 &&
      (document.confirmedExpenseAccountNo || document.suggestedExpenseAccountNo) &&
      document.creditAccountNo,
  );
}

export function buildBananaExport(input: {
  clientName: string;
  clientShortName: string;
  defaultDateBehavior: string;
  documents: ExportDocument[];
  onlyReviewed: boolean;
}) {
  const exportable = input.documents.filter((document) =>
    isExportableDocument(document, input.onlyReviewed),
  );

  const headers = [
    "Date",
    "DateDocument",
    "Doc",
    "DocInvoice",
    "ExternalReference",
    "Description",
    "AccountDebit",
    "AccountCredit",
    "Amount",
  ];

  const rows = exportable.map((document, index) => {
    const postingDate = resolvePostingDate({
      documentDate: document.documentDate,
      invoiceDate: document.invoiceDate,
      createdAt: document.createdAt,
      defaultDateBehavior: input.defaultDateBehavior,
    });

    return [
      format(postingDate, "yyyy-MM-dd"),
      document.invoiceDate ? format(document.invoiceDate, "yyyy-MM-dd") : "",
      `${index + 1}`,
      document.invoiceNumber ?? "",
      document.externalReference,
      (document.description || document.supplierName || "Beleg").replace(/\s+/g, " ").trim(),
      document.confirmedExpenseAccountNo || document.suggestedExpenseAccountNo || "",
      document.creditAccountNo || "",
      (document.grossAmount ?? 0).toFixed(2),
    ];
  });

  const content = [headers, ...rows].map((row) => row.join("\t")).join("\n");
  const monthStamp = format(new Date(), "yyyy_MM");
  const fileName = `banana_export_${input.clientShortName || input.clientName}_${monthStamp}.tsv`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");

  return {
    headers,
    rows,
    content,
    fileName,
    count: rows.length,
    includedExternalReferences: exportable.map((document) => document.externalReference),
  };
}
