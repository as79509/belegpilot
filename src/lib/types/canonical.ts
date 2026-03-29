export interface CanonicalAccountingData {
  supplierNameRaw: string | null;
  supplierNameNormalized: string | null;
  documentType: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  grossAmount: number | null;
  vatRatesDetected: Array<{ rate: number; amount: number }> | null;
  iban: string | null;
  paymentReference: string | null;
  expenseCategory: string | null;
  accountCode: string | null;
  costCenter: string | null;
}

/** Extract canonical accounting data from a Document record */
export function toCanonical(doc: Record<string, any>): CanonicalAccountingData {
  return {
    supplierNameRaw: doc.supplierNameRaw ?? null,
    supplierNameNormalized: doc.supplierNameNormalized ?? null,
    documentType: doc.documentType ?? "other",
    invoiceNumber: doc.invoiceNumber ?? null,
    invoiceDate: doc.invoiceDate ? new Date(doc.invoiceDate) : null,
    dueDate: doc.dueDate ? new Date(doc.dueDate) : null,
    currency: doc.currency ?? null,
    netAmount: doc.netAmount != null ? Number(doc.netAmount) : null,
    vatAmount: doc.vatAmount != null ? Number(doc.vatAmount) : null,
    grossAmount: doc.grossAmount != null ? Number(doc.grossAmount) : null,
    vatRatesDetected: doc.vatRatesDetected ?? null,
    iban: doc.iban ?? null,
    paymentReference: doc.paymentReference ?? null,
    expenseCategory: doc.expenseCategory ?? null,
    accountCode: doc.accountCode ?? null,
    costCenter: doc.costCenter ?? null,
  };
}

/** Convert partial canonical data back to a Document update payload */
export function fromCanonical(
  data: Partial<CanonicalAccountingData>
): Record<string, any> {
  const update: Record<string, any> = {};
  if (data.supplierNameRaw !== undefined)
    update.supplierNameRaw = data.supplierNameRaw;
  if (data.supplierNameNormalized !== undefined)
    update.supplierNameNormalized = data.supplierNameNormalized;
  if (data.documentType !== undefined) update.documentType = data.documentType;
  if (data.invoiceNumber !== undefined)
    update.invoiceNumber = data.invoiceNumber;
  if (data.invoiceDate !== undefined) update.invoiceDate = data.invoiceDate;
  if (data.dueDate !== undefined) update.dueDate = data.dueDate;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.netAmount !== undefined) update.netAmount = data.netAmount;
  if (data.vatAmount !== undefined) update.vatAmount = data.vatAmount;
  if (data.grossAmount !== undefined) update.grossAmount = data.grossAmount;
  if (data.vatRatesDetected !== undefined)
    update.vatRatesDetected = data.vatRatesDetected;
  if (data.iban !== undefined) update.iban = data.iban;
  if (data.paymentReference !== undefined)
    update.paymentReference = data.paymentReference;
  if (data.expenseCategory !== undefined)
    update.expenseCategory = data.expenseCategory;
  if (data.accountCode !== undefined) update.accountCode = data.accountCode;
  if (data.costCenter !== undefined) update.costCenter = data.costCenter;
  return update;
}
