import type { VatCalculation } from "./vat-calculator";

// Schweizer MwSt-Sätze (gültig ab 01.01.2024)
const VAT_RATE_NORMAL = 0.081;
const VAT_RATE_REDUCED = 0.026;
const VAT_RATE_SPECIAL = 0.038;

// Toleranz für Steuerberechnung (±0.10 CHF)
const TAX_TOLERANCE = 0.10;

export interface VatWarning {
  ziffer: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export function validateVatReturn(
  calc: VatCalculation,
  company: {
    vatLiable: boolean;
    vatMethod: string | null;
    vatInterval: string | null;
  }
): VatWarning[] {
  const warnings: VatWarning[] = [];

  // 1. Firma nicht MwSt-pflichtig
  if (!company.vatLiable) {
    warnings.push({
      ziffer: "general",
      message: "Firma ist nicht als MwSt-pflichtig markiert",
      severity: "error",
    });
  }

  // 2. Kein Umsatz
  if (calc.ziffer200 === 0) {
    warnings.push({
      ziffer: "200",
      message: "Kein Umsatz in dieser Periode",
      severity: "warning",
    });
  }

  // 3. Steuer > 0 aber kein steuerbarer Umsatz
  if (calc.totalSteuer > 0 && calc.steuerbarerUmsatz <= 0) {
    warnings.push({
      ziffer: "totalSteuer",
      message: "Steuerbeträge ohne steuerbaren Umsatz",
      severity: "error",
    });
  }

  // 4. Steuerbarer Umsatz > 0 aber keine Steuer
  if (calc.steuerbarerUmsatz > 0 && calc.totalSteuer === 0) {
    warnings.push({
      ziffer: "totalSteuer",
      message: "Steuerbarer Umsatz vorhanden, aber keine Steuer berechnet",
      severity: "warning",
    });
  }

  // 5. Steuerberechnung Normalsatz: steuer302 ≈ ziffer302 × 8.1%
  if (calc.ziffer302 > 0) {
    const expected = Math.round((calc.ziffer302 * VAT_RATE_NORMAL + Number.EPSILON) * 100) / 100;
    if (Math.abs(calc.steuer302 - expected) > TAX_TOLERANCE) {
      warnings.push({
        ziffer: "302",
        message: `Steuerberechnung weicht ab bei Ziffer 302: erwartet ${expected.toFixed(2)} CHF (8.1% von ${calc.ziffer302.toFixed(2)}), berechnet ${calc.steuer302.toFixed(2)} CHF`,
        severity: "error",
      });
    }
  }

  // 6a. Steuerberechnung Reduzierter Satz: steuer312 ≈ ziffer312 × 2.6%
  if (calc.ziffer312 > 0) {
    const expected = Math.round((calc.ziffer312 * VAT_RATE_REDUCED + Number.EPSILON) * 100) / 100;
    if (Math.abs(calc.steuer312 - expected) > TAX_TOLERANCE) {
      warnings.push({
        ziffer: "312",
        message: `Steuerberechnung weicht ab bei Ziffer 312: erwartet ${expected.toFixed(2)} CHF (2.6% von ${calc.ziffer312.toFixed(2)}), berechnet ${calc.steuer312.toFixed(2)} CHF`,
        severity: "error",
      });
    }
  }

  // 6b. Steuerberechnung Sondersatz: steuer342 ≈ ziffer342 × 3.8%
  if (calc.ziffer342 > 0) {
    const expected = Math.round((calc.ziffer342 * VAT_RATE_SPECIAL + Number.EPSILON) * 100) / 100;
    if (Math.abs(calc.steuer342 - expected) > TAX_TOLERANCE) {
      warnings.push({
        ziffer: "342",
        message: `Steuerberechnung weicht ab bei Ziffer 342: erwartet ${expected.toFixed(2)} CHF (3.8% von ${calc.ziffer342.toFixed(2)}), berechnet ${calc.steuer342.toFixed(2)} CHF`,
        severity: "error",
      });
    }
  }

  // 7. Vorsteuer > Steuer (Guthaben)
  if (calc.totalVorsteuer > calc.totalSteuer && calc.totalSteuer > 0) {
    warnings.push({
      ziffer: "zahllast",
      message: "Vorsteuer übersteigt Steuerschuld — Guthaben",
      severity: "warning",
    });
  }

  // 8. Keine Vorsteuer bei Belegen mit MwSt
  if (calc.totalSteuer > 0 && calc.totalVorsteuer === 0 && calc.documentCount > 0) {
    warnings.push({
      ziffer: "400",
      message: "Belege mit MwSt vorhanden, aber keine Vorsteuer geltend gemacht",
      severity: "warning",
    });
  }

  // 9. Belege ohne MwSt-Satz (document count > 0 but no tax amounts)
  const docsWithTax =
    calc.ziffer302 > 0 || calc.ziffer312 > 0 || calc.ziffer342 > 0 ? calc.documentCount : 0;
  const docsWithoutVat = calc.documentCount - docsWithTax;
  if (docsWithoutVat > 0 && calc.documentCount > 0) {
    warnings.push({
      ziffer: "general",
      message: `${docsWithoutVat} Belege ohne erkannten MwSt-Satz`,
      severity: "info",
    });
  }

  return warnings;
}
