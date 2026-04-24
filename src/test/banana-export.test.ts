import { describe, expect, it } from "vitest";

import { buildBananaExport } from "@/lib/banana";

describe("buildBananaExport", () => {
  it("creates a Banana-compatible TSV with stable headers", () => {
    const exportBundle = buildBananaExport({
      clientName: "Demo Treuhand AG",
      clientShortName: "demo",
      defaultDateBehavior: "document_first",
      onlyReviewed: true,
      documents: [
        {
          id: "doc-1",
          status: "geprueft",
          documentDate: new Date("2026-04-01T10:00:00Z"),
          invoiceDate: new Date("2026-04-01T10:00:00Z"),
          invoiceNumber: "R-42",
          description: "Papeterie",
          supplierName: "Papeterie Muster",
          grossAmount: 48.2,
          confirmedExpenseAccountNo: "4200",
          suggestedExpenseAccountNo: "4200",
          creditAccountNo: "2000",
          externalReference: "DEMO-20260401-ABC12345",
          createdAt: new Date("2026-04-01T10:00:00Z"),
        },
      ],
    });

    expect(exportBundle.headers).toEqual([
      "Date",
      "DateDocument",
      "Doc",
      "DocInvoice",
      "ExternalReference",
      "Description",
      "AccountDebit",
      "AccountCredit",
      "Amount",
    ]);
    expect(exportBundle.count).toBe(1);
    expect(exportBundle.content).toContain("DEMO-20260401-ABC12345");
    expect(exportBundle.content).toContain("4200\t2000\t48.20");
  });
});
