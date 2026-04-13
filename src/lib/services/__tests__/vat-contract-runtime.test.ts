import { describe, expect, it } from "vitest";
import { mergeVatCreateResponse, selectVatReturnById, type VatCreateResponse } from "@/lib/services/vat/vat-contract";

describe("VAT Contract Runtime", () => {
  it("verschmilzt POST-Response so, dass die UI direkt mit vatReturn arbeitet", () => {
    const response: VatCreateResponse<{
      id: string;
      warnings: Array<{ ziffer: string; message: string; severity: "warning" | "error" | "info" }> | null;
      status: string;
    }> = {
      vatReturn: {
        id: "vat-1",
        warnings: null,
        status: "draft",
      },
      calculation: {
        ziffer200: 1000,
        ziffer205: 0,
        ziffer220: 0,
        ziffer221: 0,
        ziffer225: 0,
        ziffer230: 0,
        ziffer235: 0,
        steuerbarerUmsatz: 1000,
        ziffer302: 1000,
        steuer302: 81,
        ziffer312: 0,
        steuer312: 0,
        ziffer342: 0,
        steuer342: 0,
        ziffer382: 0,
        steuer382: 0,
        totalSteuer: 81,
        ziffer400: 0,
        ziffer405: 0,
        ziffer410: 0,
        ziffer415: 0,
        ziffer420: 0,
        totalVorsteuer: 0,
        zahllast: 81,
        documentCount: 3,
        journalCount: 1,
      },
      warnings: [
        { ziffer: "200", message: "Kein Umsatz in dieser Periode", severity: "warning" },
      ],
    };

    expect(mergeVatCreateResponse(response)).toEqual({
      id: "vat-1",
      warnings: response.warnings,
      status: "draft",
    });
  });

  it("selektiert nach dem Reload dieselbe MwSt-Abrechnung wieder anhand der ID", () => {
    const vatReturns = [
      { id: "vat-1", status: "draft" },
      { id: "vat-2", status: "validated" },
    ];

    expect(selectVatReturnById(vatReturns, "vat-2")).toEqual({ id: "vat-2", status: "validated" });
    expect(selectVatReturnById(vatReturns, "missing")).toBeNull();
    expect(selectVatReturnById(vatReturns, null)).toBeNull();
  });
});
