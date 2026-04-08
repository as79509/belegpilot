import Anthropic from "@anthropic-ai/sdk";
import type {
  AiNormalizerService,
  AiNormalizerResult,
  NormalizedInvoiceData,
} from "./ai-normalizer.interface";

const SYSTEM_PROMPT = `You are an expert accounting document parser specializing in Swiss and European invoices. You receive images of an invoice or receipt. Extract all data and normalize it into strict JSON.

Rules:
1. Return ONLY valid JSON. No markdown, no explanation, no preamble.
2. Normalize supplier names: remove legal suffixes (GmbH, AG, SA, Ltd, S.à r.l.) only in the normalized field. Keep raw exactly as printed.
3. Dates in ISO 8601 format (YYYY-MM-DD).
4. Amounts as numbers with 2 decimal places. No currency symbols. No thousands separators.
5. Currency as ISO 4217 code (CHF, EUR, USD, GBP).
6. If a field cannot be determined, set it to null.
7. confidence is 0.0 to 1.0 reflecting overall extraction quality.
8. document_type: one of invoice, credit_note, receipt, reminder, other.
9. For Swiss documents: detect QR-bill reference numbers, ESR/ISR numbers, Swiss QR-IBAN.
10. For VAT: detect Swiss MWST rates (8.1%, 2.6%, 3.8%) and EU VAT rates.
11. extracted_text: provide the complete text content you can read from the document.
12. reasoning_summary: one sentence explaining extraction quality and any issues found.

Return this exact JSON structure:
{
  "supplier_name_raw": "string|null",
  "supplier_name_normalized": "string|null",
  "supplier_vat_number": "string|null",
  "document_type": "invoice|credit_note|receipt|reminder|other",
  "invoice_number": "string|null",
  "invoice_date": "YYYY-MM-DD|null",
  "due_date": "YYYY-MM-DD|null",
  "currency": "CHF|EUR|USD|null",
  "net_amount": "number|null",
  "vat_amount": "number|null",
  "gross_amount": "number|null",
  "vat_rates": [{"rate": "number", "amount": "number"}],
  "iban": "string|null",
  "payment_reference": "string|null",
  "expense_category_suggestion": "string|null",
  "account_code_suggestion": "string|null",
  "cost_center_suggestion": "string|null",
  "line_items": [{"description": "string", "quantity": "number|null", "unit_price": "number|null", "total": "number|null", "vat_rate": "number|null"}],
  "confidence": "number",
  "reasoning_summary": "string",
  "extracted_text": "string"
}`;

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export class ClaudeNormalizer implements AiNormalizerService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async normalize(
    buffers: Buffer[],
    mimeType: string,
    metadata?: Record<string, unknown>
  ): Promise<AiNormalizerResult> {
    const contentBlocks: any[] = [];

    if (mimeType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: buffers[0].toString("base64"),
        },
      });
    } else {
      const imageMediaType = this.toImageMediaType(mimeType);
      for (const buf of buffers) {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: imageMediaType,
            data: buf.toString("base64"),
          },
        });
      }
    }

    contentBlocks.push({
      type: "text",
      text: "Extract and normalize all data from this document into the specified JSON structure.",
    });

    // Use beta API for PDF document support
    const response = await this.client.beta.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      betas: ["pdfs-2024-09-25"],
      system: metadata?.context
        ? `${SYSTEM_PROMPT}\n\nAdditional context about this company:\n${metadata.context}`
        : SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const raw = textBlock.text.trim();

    // Handle potential markdown code block wrapping
    let jsonStr = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    try {
      const data = JSON.parse(jsonStr) as NormalizedInvoiceData;
      return {
        data,
        usage: {
          inputTokens: (response as any).usage?.input_tokens || 0,
          outputTokens: (response as any).usage?.output_tokens || 0,
          model: "claude-sonnet-4-20250514",
        },
      };
    } catch {
      throw new Error(
        `Failed to parse Claude response as JSON: ${raw.substring(0, 200)}`
      );
    }
  }

  private toImageMediaType(mimeType: string): ImageMediaType {
    const map: Record<string, ImageMediaType> = {
      "image/png": "image/png",
      "image/jpeg": "image/jpeg",
      "image/jpg": "image/jpeg",
      "image/gif": "image/gif",
      "image/webp": "image/webp",
    };
    return map[mimeType] || "image/png";
  }
}
