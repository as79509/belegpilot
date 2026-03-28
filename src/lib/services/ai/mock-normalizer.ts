import type {
  AiNormalizerService,
  NormalizedInvoiceData,
} from "./ai-normalizer.interface";

export class MockNormalizer implements AiNormalizerService {
  async normalize(
    _images: Buffer[],
    _mimeType: string,
    metadata?: Record<string, unknown>
  ): Promise<NormalizedInvoiceData> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fileName =
      (metadata?.fileName as string)?.toLowerCase() || "invoice.pdf";

    // Return credit note data if filename suggests it
    if (fileName.includes("credit") || fileName.includes("gutschrift")) {
      return {
        supplier_name_raw: "Muster AG",
        supplier_name_normalized: "Muster",
        supplier_vat_number: "CHE-111.222.333 MWST",
        document_type: "credit_note",
        invoice_number: "GS-2026-001",
        invoice_date: "2026-03-15",
        due_date: null,
        currency: "CHF",
        net_amount: -500.0,
        vat_amount: -40.5,
        gross_amount: -540.5,
        vat_rates: [{ rate: 8.1, amount: -40.5 }],
        iban: "CH93 0076 2011 6238 5295 7",
        payment_reference: null,
        expense_category_suggestion: "Warenrücksendung",
        account_code_suggestion: "3200",
        cost_center_suggestion: null,
        line_items: [
          {
            description: "Gutschrift für Retoure",
            quantity: 1,
            unit_price: -500.0,
            total: -500.0,
            vat_rate: 8.1,
          },
        ],
        confidence: 0.92,
        reasoning_summary:
          "Credit note clearly identified with negative amounts and reference to original invoice.",
        extracted_text:
          "Muster AG\nGutschrift GS-2026-001\nDatum: 15.03.2026\nGutschriftsbetrag: CHF -540.50",
      };
    }

    // Default: realistic Swiss invoice
    return {
      supplier_name_raw: "Beispiel GmbH",
      supplier_name_normalized: "Beispiel",
      supplier_vat_number: "CHE-123.456.789 MWST",
      document_type: "invoice",
      invoice_number: "RE-2026-0042",
      invoice_date: "2026-03-20",
      due_date: "2026-04-20",
      currency: "CHF",
      net_amount: 1250.0,
      vat_amount: 101.25,
      gross_amount: 1351.25,
      vat_rates: [{ rate: 8.1, amount: 101.25 }],
      iban: "CH93 0076 2011 6238 5295 7",
      payment_reference: "21 00000 00003 13947 14300 09017",
      expense_category_suggestion: "Büromaterial",
      account_code_suggestion: "6500",
      cost_center_suggestion: "100",
      line_items: [
        {
          description: "Druckerpapier A4, 5x 500 Blatt",
          quantity: 5,
          unit_price: 45.0,
          total: 225.0,
          vat_rate: 8.1,
        },
        {
          description: "Toner HP LaserJet Pro",
          quantity: 2,
          unit_price: 189.0,
          total: 378.0,
          vat_rate: 8.1,
        },
        {
          description: "IT-Dienstleistung Monat März",
          quantity: 1,
          unit_price: 647.0,
          total: 647.0,
          vat_rate: 8.1,
        },
      ],
      confidence: 0.88,
      reasoning_summary:
        "All key fields extracted with high confidence. Swiss QR-bill reference detected.",
      extracted_text:
        "Beispiel GmbH\nMusterstrasse 10\n8001 Zürich\n\nRechnung RE-2026-0042\nDatum: 20.03.2026\nFällig: 20.04.2026\n\nPos  Beschreibung                    Menge  Preis    Total\n1    Druckerpapier A4, 5x 500 Blatt  5      45.00    225.00\n2    Toner HP LaserJet Pro            2      189.00   378.00\n3    IT-Dienstleistung Monat März     1      647.00   647.00\n\nNetto:  CHF 1'250.00\nMWST 8.1%: CHF 101.25\nTotal: CHF 1'351.25\n\nZahlbar bis: 20.04.2026\nIBAN: CH93 0076 2011 6238 5295 7\nCHE-123.456.789 MWST",
    };
  }
}
