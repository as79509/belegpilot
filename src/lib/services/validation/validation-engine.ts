import type { CanonicalAccountingData } from "@/lib/types/canonical";
import { prisma } from "@/lib/db";

export interface ValidationCheck {
  checkName: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message: string;
  field?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  overallPassed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface MinimalDocumentInfo {
  id: string;
  supplierNameNormalized: string | null;
  invoiceNumber: string | null;
  grossAmount: number | null;
}

const VALID_CURRENCIES = [
  "CHF", "EUR", "USD", "GBP", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK",
  "PLN", "CZK", "HUF", "RON", "BGN", "HRK", "TRY",
];

const SWISS_VAT_RATES = [8.1, 2.6, 3.8];
const EU_VAT_RATES = [5, 6, 7, 9, 10, 12, 13, 14, 15, 17, 19, 20, 21, 22, 23, 24, 25, 27];

function checkMathConsistency(c: CanonicalAccountingData): ValidationCheck {
  if (c.netAmount != null && c.vatAmount != null && c.grossAmount != null) {
    const diff = Math.abs(c.netAmount + c.vatAmount - c.grossAmount);
    if (diff > 0.05) {
      return {
        checkName: "math_consistency",
        passed: false,
        severity: "error",
        message: `Netto + MwSt weicht vom Bruttobetrag ab (Differenz: ${diff.toFixed(2)})`,
        field: "grossAmount",
      };
    }
  }
  return {
    checkName: "math_consistency",
    passed: true,
    severity: "info",
    message: "Beträge konsistent",
  };
}

function checkGrossAmountPresent(c: CanonicalAccountingData): ValidationCheck {
  return {
    checkName: "gross_amount_present",
    passed: c.grossAmount != null,
    severity: "error",
    message: c.grossAmount != null ? "Bruttobetrag vorhanden" : "Bruttobetrag fehlt",
    field: "grossAmount",
  };
}

function checkCurrencyValid(c: CanonicalAccountingData): ValidationCheck {
  if (!c.currency) {
    return {
      checkName: "currency_valid",
      passed: true,
      severity: "info",
      message: "Keine Währung angegeben",
      field: "currency",
    };
  }
  const valid = VALID_CURRENCIES.includes(c.currency.toUpperCase());
  return {
    checkName: "currency_valid",
    passed: valid,
    severity: "error",
    message: valid ? "Gültige Währung" : `Ungültige Währung: ${c.currency}`,
    field: "currency",
  };
}

function checkInvoiceDatePresent(c: CanonicalAccountingData): ValidationCheck {
  return {
    checkName: "invoice_date_present",
    passed: c.invoiceDate != null,
    severity: "warning",
    message: c.invoiceDate != null ? "Rechnungsdatum vorhanden" : "Rechnungsdatum fehlt",
    field: "invoiceDate",
  };
}

function checkInvoiceDatePlausible(c: CanonicalAccountingData): ValidationCheck {
  if (!c.invoiceDate) {
    return { checkName: "invoice_date_plausible", passed: true, severity: "info", message: "Kein Datum zur Prüfung", field: "invoiceDate" };
  }
  const now = new Date();
  if (c.invoiceDate > now) {
    return { checkName: "invoice_date_plausible", passed: false, severity: "warning", message: "Rechnungsdatum liegt in der Zukunft", field: "invoiceDate" };
  }
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  if (c.invoiceDate < twoYearsAgo) {
    return { checkName: "invoice_date_plausible", passed: false, severity: "warning", message: "Rechnungsdatum ist älter als 2 Jahre", field: "invoiceDate" };
  }
  return { checkName: "invoice_date_plausible", passed: true, severity: "info", message: "Rechnungsdatum plausibel", field: "invoiceDate" };
}

function checkDueDateAfterInvoiceDate(c: CanonicalAccountingData): ValidationCheck {
  if (!c.invoiceDate || !c.dueDate) {
    return { checkName: "due_date_after_invoice", passed: true, severity: "info", message: "Kein Datumsvergleich möglich" };
  }
  const passed = c.dueDate >= c.invoiceDate;
  return {
    checkName: "due_date_after_invoice",
    passed,
    severity: "warning",
    message: passed ? "Fälligkeitsdatum korrekt" : "Fälligkeitsdatum liegt vor dem Rechnungsdatum",
    field: "dueDate",
  };
}

function checkSupplierNamePresent(c: CanonicalAccountingData): ValidationCheck {
  const present = !!c.supplierNameRaw?.trim();
  return {
    checkName: "supplier_name_present",
    passed: present,
    severity: "warning",
    message: present ? "Lieferantenname vorhanden" : "Lieferantenname fehlt",
    field: "supplierNameRaw",
  };
}

function checkInvoiceNumberPresent(c: CanonicalAccountingData): ValidationCheck {
  const present = !!c.invoiceNumber?.trim();
  return {
    checkName: "invoice_number_present",
    passed: present,
    severity: "warning",
    message: present ? "Rechnungsnummer vorhanden" : "Rechnungsnummer fehlt",
    field: "invoiceNumber",
  };
}

function checkDuplicateByFields(
  c: CanonicalAccountingData,
  existingDocs?: MinimalDocumentInfo[]
): ValidationCheck {
  if (!existingDocs?.length || !c.supplierNameNormalized || !c.invoiceNumber || c.grossAmount == null) {
    return { checkName: "duplicate_by_fields", passed: true, severity: "info", message: "Keine Duplikatprüfung möglich" };
  }
  const dup = existingDocs.find(
    (d) =>
      d.supplierNameNormalized === c.supplierNameNormalized &&
      d.invoiceNumber === c.invoiceNumber &&
      d.grossAmount != null &&
      Math.abs(d.grossAmount - c.grossAmount!) < 0.01
  );
  if (dup) {
    return {
      checkName: "duplicate_by_fields",
      passed: false,
      severity: "error",
      message: `Mögliches Duplikat: Gleicher Lieferant, Rechnungsnr. und Betrag wie Beleg ${dup.id.slice(0, 8)}`,
      metadata: { duplicateDocumentId: dup.id },
    };
  }
  return { checkName: "duplicate_by_fields", passed: true, severity: "info", message: "Kein Duplikat erkannt" };
}

function checkVatRatesPlausible(c: CanonicalAccountingData): ValidationCheck {
  if (!c.vatRatesDetected?.length) {
    return { checkName: "vat_rates_plausible", passed: true, severity: "info", message: "Keine MwSt-Sätze zur Prüfung" };
  }
  const knownRates = c.currency === "CHF" ? SWISS_VAT_RATES : [...SWISS_VAT_RATES, ...EU_VAT_RATES];
  const unusual = c.vatRatesDetected.filter((r) => !knownRates.includes(r.rate));
  if (unusual.length > 0) {
    return {
      checkName: "vat_rates_plausible",
      passed: false,
      severity: "info",
      message: `Ungewöhnlicher MwSt-Satz: ${unusual.map((r) => r.rate + "%").join(", ")}`,
    };
  }
  return { checkName: "vat_rates_plausible", passed: true, severity: "info", message: "MwSt-Sätze plausibel" };
}

function checkAmountPlausible(c: CanonicalAccountingData): ValidationCheck {
  if (c.grossAmount == null) {
    return { checkName: "amount_plausible", passed: true, severity: "info", message: "Kein Betrag zur Prüfung" };
  }
  if (c.grossAmount <= 0) {
    return { checkName: "amount_plausible", passed: false, severity: "info", message: "Betrag ist null oder negativ", field: "grossAmount" };
  }
  if (c.grossAmount > 50000) {
    return { checkName: "amount_plausible", passed: false, severity: "info", message: "Ungewöhnlich hoher Betrag", field: "grossAmount" };
  }
  return { checkName: "amount_plausible", passed: true, severity: "info", message: "Betrag plausibel" };
}

export function validateDocument(
  canonical: CanonicalAccountingData,
  existingDocuments?: MinimalDocumentInfo[]
): ValidationResult {
  const checks: ValidationCheck[] = [
    checkMathConsistency(canonical),
    checkGrossAmountPresent(canonical),
    checkCurrencyValid(canonical),
    checkInvoiceDatePresent(canonical),
    checkInvoiceDatePlausible(canonical),
    checkDueDateAfterInvoiceDate(canonical),
    checkSupplierNamePresent(canonical),
    checkInvoiceNumberPresent(canonical),
    checkDuplicateByFields(canonical, existingDocuments),
    checkVatRatesPlausible(canonical),
    checkAmountPlausible(canonical),
  ];

  const errorCount = checks.filter((c) => !c.passed && c.severity === "error").length;
  const warningCount = checks.filter((c) => !c.passed && c.severity === "warning").length;

  return {
    checks,
    overallPassed: errorCount === 0,
    errorCount,
    warningCount,
  };
}

/** Extended validation including async chart-of-accounts check */
export async function validateDocumentWithChart(
  canonical: CanonicalAccountingData,
  companyId: string,
  existingDocuments?: MinimalDocumentInfo[]
): Promise<ValidationResult> {
  const result = validateDocument(canonical, existingDocuments);

  // Check account_in_chart
  if (canonical.accountCode) {
    const account = await prisma.account.findFirst({
      where: {
        companyId,
        accountNumber: canonical.accountCode,
        isActive: true,
      },
    });

    result.checks.push({
      checkName: "account_in_chart",
      passed: !!account,
      severity: "warning",
      message: account
        ? `Konto ${canonical.accountCode} ist im Kontenplan`
        : `Konto ${canonical.accountCode} ist nicht im Kontenplan`,
      field: "accountCode",
    });

    if (!account) {
      result.warningCount++;
    }
  }

  return result;
}
