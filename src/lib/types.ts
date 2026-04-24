export type LiteSettings = {
  id?: string;
  appName?: string;
  defaultCurrency?: string;
  aiBaseUrl?: string | null;
  aiApiKey?: string | null;
  aiModel?: string | null;
  aiOcrModel?: string | null;
  aiTimeoutMs?: number | null;
  exportDefaultCreditAccount?: string | null;
  exportDefaultExpenseAccount?: string | null;
  defaultDateBehavior?: string | null;
  globalExternalReferencePrefix?: string | null;
};

export type StructuredAccount = {
  accountNo: string;
  name: string;
  kind?: string | null;
  isActive: boolean;
};

export type ExtractedDocumentResult = {
  supplierName?: string | null;
  documentDate?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  invoiceNumber?: string | null;
  currency?: string | null;
  grossAmount?: number | null;
  shortDescription?: string | null;
  suggestedExpenseAccount?: string | null;
  reasoningShort?: string | null;
  confidenceLabel?: "niedrig" | "mittel" | "hoch" | null;
  taxHint?: string | null;
};
