import { prisma } from "@/lib/db";

// Schweizer MwSt-Sätze (gültig ab 01.01.2024)
const VAT_RATES = {
  NORMAL: 0.081,     // 8.1%
  REDUCED: 0.026,    // 2.6%
  SPECIAL: 0.038,    // 3.8% Beherbergung
} as const;

// ── Types ──

export interface VatCalculation {
  // Umsatz-Ziffern
  ziffer200: number; // Gesamtumsatz
  ziffer205: number; // Nicht steuerbar
  ziffer220: number; // Steuerbefreit
  ziffer221: number; // Ausland
  ziffer225: number; // Minderungen
  ziffer230: number; // Subventionen
  ziffer235: number; // Diverses
  steuerbarerUmsatz: number; // = 200 - (205+220+221+225+230+235)

  // Steuer
  ziffer302: number; steuer302: number; // Normalsatz
  ziffer312: number; steuer312: number; // Reduzierter Satz
  ziffer342: number; steuer342: number; // Sondersatz
  ziffer382: number; steuer382: number; // Bezugsteuer
  totalSteuer: number;

  // Vorsteuer
  ziffer400: number; // Material/DL
  ziffer405: number; // Investitionen
  ziffer410: number; // Einlageentsteuerung
  ziffer415: number; // Korrekturen
  ziffer420: number; // Kürzungen
  totalVorsteuer: number;

  // Ergebnis
  zahllast: number; // totalSteuer - totalVorsteuer

  // Metadaten
  documentCount: number;
  journalCount: number;
}

// ── Date range helper ──

function getPeriodRange(
  year: number,
  quarter: number,
  periodType: "quarterly" | "semi_annual" | "annual"
): { from: Date; to: Date } {
  let fromMonth: number;
  let toMonth: number;

  if (periodType === "annual") {
    fromMonth = 0; // January
    toMonth = 11;  // December
  } else if (periodType === "semi_annual") {
    fromMonth = (quarter - 1) * 6; // 0 or 6
    toMonth = fromMonth + 5;
  } else {
    // quarterly
    fromMonth = (quarter - 1) * 3; // 0, 3, 6, 9
    toMonth = fromMonth + 2;
  }

  const from = new Date(Date.UTC(year, fromMonth, 1));
  const to = new Date(Date.UTC(year, toMonth + 1, 0, 23, 59, 59, 999)); // Last day of month
  return { from, to };
}

// ── VAT rate classification ──

function classifyVatRate(rate: number): "normal" | "reduced" | "special" | "unknown" {
  // Allow small tolerance for floating point
  if (Math.abs(rate - 8.1) < 0.2 || Math.abs(rate - 0.081) < 0.002) return "normal";
  if (Math.abs(rate - 2.6) < 0.2 || Math.abs(rate - 0.026) < 0.002) return "reduced";
  if (Math.abs(rate - 3.8) < 0.2 || Math.abs(rate - 0.038) < 0.002) return "special";
  // Old rates (before 2024)
  if (Math.abs(rate - 7.7) < 0.2 || Math.abs(rate - 0.077) < 0.002) return "normal";
  if (Math.abs(rate - 2.5) < 0.2 || Math.abs(rate - 0.025) < 0.002) return "reduced";
  if (Math.abs(rate - 3.7) < 0.2 || Math.abs(rate - 0.037) < 0.002) return "special";
  return "unknown";
}

/** Round to 2 decimal places (kaufmännisch) */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Main calculation ──

export async function calculateVatReturn(
  companyId: string,
  year: number,
  quarter: number,
  periodType: "quarterly" | "semi_annual" | "annual"
): Promise<VatCalculation> {
  const { from, to } = getPeriodRange(year, quarter, periodType);

  // Load all documents in the period
  const documents = await prisma.document.findMany({
    where: {
      companyId,
      invoiceDate: { gte: from, lte: to },
      status: { notIn: ["rejected", "failed"] },
    },
    select: {
      id: true,
      documentType: true,
      grossAmount: true,
      netAmount: true,
      vatAmount: true,
      vatRatesDetected: true,
      currency: true,
    },
  });

  // Load VAT-relevant journal entries in the period
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      entryDate: { gte: from, lte: to },
      vatAmount: { not: null, gt: 0 },
    },
    select: {
      id: true,
      amount: true,
      vatAmount: true,
      vatRate: true,
      entryType: true,
    },
  });

  // Initialize accumulators
  let ziffer200 = 0; // Gesamtumsatz
  let ziffer205 = 0; // Nicht steuerbar
  let ziffer220 = 0; // Steuerbefreit
  let ziffer221 = 0; // Ausland
  let ziffer225 = 0; // Minderungen (credit notes)
  let ziffer230 = 0; // Subventionen
  let ziffer235 = 0; // Diverses

  let ziffer302 = 0; // Normalsatz Basis
  let ziffer312 = 0; // Reduzierter Satz Basis
  let ziffer342 = 0; // Sondersatz Basis
  let ziffer382 = 0; // Bezugsteuer Basis

  let steuer302 = 0; // Steuer Normalsatz
  let steuer312 = 0; // Steuer reduzierter Satz
  let steuer342 = 0; // Steuer Sondersatz
  let steuer382 = 0; // Steuer Bezugsteuer

  let ziffer400 = 0; // Vorsteuer Material/DL
  let ziffer405 = 0; // Vorsteuer Investitionen
  let ziffer410 = 0; // Einlageentsteuerung
  let ziffer415 = 0; // Korrekturen
  let ziffer420 = 0; // Kürzungen

  // Process documents
  for (const doc of documents) {
    const gross = doc.grossAmount ? Number(doc.grossAmount) : 0;
    const net = doc.netAmount ? Number(doc.netAmount) : 0;
    const vatAmt = doc.vatAmount ? Number(doc.vatAmount) : 0;

    // Credit notes → Minderungen (Ziffer 225)
    if (doc.documentType === "credit_note") {
      ziffer225 += gross;
      // Vorsteuer-Korrektur for credit notes
      if (vatAmt > 0) {
        ziffer415 += vatAmt;
      }
      continue;
    }

    // Add to Gesamtumsatz
    ziffer200 += gross;

    // Classify by VAT rates
    const vatRates = parseVatRates(doc.vatRatesDetected);

    if (vatRates.length > 0) {
      // Document has detected VAT rates — distribute
      for (const vr of vatRates) {
        const rateClass = classifyVatRate(vr.rate);
        const base = vr.base ?? net;
        const tax = vr.amount ?? round2(base * normalizeRate(vr.rate));

        switch (rateClass) {
          case "normal":
            ziffer302 += base;
            steuer302 += tax;
            break;
          case "reduced":
            ziffer312 += base;
            steuer312 += tax;
            break;
          case "special":
            ziffer342 += base;
            steuer342 += tax;
            break;
          default:
            // Unknown rate — still count towards Normalsatz as fallback
            ziffer302 += base;
            steuer302 += tax;
            break;
        }
      }
    } else if (vatAmt > 0) {
      // No detailed rates but has vatAmount — assume Normalsatz
      ziffer302 += net || round2(gross - vatAmt);
      steuer302 += vatAmt;
    }

    // Vorsteuer: all incoming invoices with VAT
    if (vatAmt > 0) {
      ziffer400 += vatAmt;
    }
  }

  // Process journal entries (additional VAT from manual bookings)
  for (const je of journalEntries) {
    const amount = Number(je.amount);
    const vatAmt = je.vatAmount ? Number(je.vatAmount) : 0;
    const rate = je.vatRate ?? 0;

    if (vatAmt > 0 && rate > 0) {
      const rateClass = classifyVatRate(rate);
      const base = round2(amount - vatAmt);

      switch (rateClass) {
        case "normal":
          ziffer302 += base;
          steuer302 += vatAmt;
          break;
        case "reduced":
          ziffer312 += base;
          steuer312 += vatAmt;
          break;
        case "special":
          ziffer342 += base;
          steuer342 += vatAmt;
          break;
        default:
          ziffer302 += base;
          steuer302 += vatAmt;
          break;
      }

      // Journal entries with VAT also contribute to Vorsteuer
      ziffer400 += vatAmt;
    }
  }

  // Round all values
  ziffer200 = round2(ziffer200);
  ziffer205 = round2(ziffer205);
  ziffer220 = round2(ziffer220);
  ziffer221 = round2(ziffer221);
  ziffer225 = round2(ziffer225);
  ziffer230 = round2(ziffer230);
  ziffer235 = round2(ziffer235);

  ziffer302 = round2(ziffer302);
  ziffer312 = round2(ziffer312);
  ziffer342 = round2(ziffer342);
  ziffer382 = round2(ziffer382);
  steuer302 = round2(steuer302);
  steuer312 = round2(steuer312);
  steuer342 = round2(steuer342);
  steuer382 = round2(steuer382);

  ziffer400 = round2(ziffer400);
  ziffer405 = round2(ziffer405);
  ziffer410 = round2(ziffer410);
  ziffer415 = round2(ziffer415);
  ziffer420 = round2(ziffer420);

  const steuerbarerUmsatz = round2(
    ziffer200 - (ziffer205 + ziffer220 + ziffer221 + ziffer225 + ziffer230 + ziffer235)
  );
  const totalSteuer = round2(steuer302 + steuer312 + steuer342 + steuer382);
  const totalVorsteuer = round2(ziffer400 + ziffer405 + ziffer410 - ziffer415 - ziffer420);
  const zahllast = round2(totalSteuer - totalVorsteuer);

  return {
    ziffer200, ziffer205, ziffer220, ziffer221, ziffer225, ziffer230, ziffer235,
    steuerbarerUmsatz,
    ziffer302, steuer302,
    ziffer312, steuer312,
    ziffer342, steuer342,
    ziffer382, steuer382,
    totalSteuer,
    ziffer400, ziffer405, ziffer410, ziffer415, ziffer420,
    totalVorsteuer,
    zahllast,
    documentCount: documents.length,
    journalCount: journalEntries.length,
  };
}

// ── Helpers ──

interface VatRateEntry {
  rate: number;
  base?: number;
  amount?: number;
}

function parseVatRates(vatRatesDetected: any): VatRateEntry[] {
  if (!vatRatesDetected) return [];
  if (Array.isArray(vatRatesDetected)) {
    return vatRatesDetected.filter(
      (v: any) => v && typeof v.rate === "number"
    ) as VatRateEntry[];
  }
  return [];
}

/** Normalize rate: if > 1, it's in percent form (e.g. 8.1), convert to decimal. */
function normalizeRate(rate: number): number {
  return rate > 1 ? rate / 100 : rate;
}
