export interface NormalizedInvoiceData {
  supplier_name_raw: string | null;
  supplier_name_normalized: string | null;
  supplier_vat_number: string | null;
  document_type: "invoice" | "credit_note" | "receipt" | "reminder" | "other";
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  vat_rates: Array<{ rate: number; amount: number }>;
  iban: string | null;
  payment_reference: string | null;
  expense_category_suggestion: string | null;
  account_code_suggestion: string | null;
  cost_center_suggestion: string | null;
  line_items: Array<{
    description: string;
    quantity: number | null;
    unit_price: number | null;
    total: number | null;
    vat_rate: number | null;
  }>;
  confidence: number;
  reasoning_summary: string;
  extracted_text: string;
}

export interface AiNormalizerResult {
  data: NormalizedInvoiceData;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

export interface AiNormalizerService {
  normalize(
    images: Buffer[],
    mimeType: string,
    metadata?: Record<string, unknown>
  ): Promise<AiNormalizerResult>;
}
