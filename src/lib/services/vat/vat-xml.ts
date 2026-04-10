/**
 * Generiert eCH-0217 XML für das ePortal der ESTV.
 *
 * TODO Phase 9.3.3: Vollständige Implementierung
 * Zielformat: eCH-0217 v1.0
 * Referenz: https://www.estv.admin.ch/estv/de/home/mehrwertsteuer/formulare/online-abrechnung.html
 */

interface VatReturnData {
  year: number;
  quarter: number;
  periodType: string;
  status: string;
  ziffer200: number;
  ziffer205: number;
  ziffer220: number;
  ziffer221: number;
  ziffer225: number;
  ziffer230: number;
  ziffer235: number;
  ziffer302: number;
  ziffer312: number;
  ziffer342: number;
  ziffer382: number;
  steuer302: number;
  steuer312: number;
  steuer342: number;
  steuer382: number;
  ziffer400: number;
  ziffer405: number;
  ziffer410: number;
  ziffer415: number;
  ziffer420: number;
}

interface CompanyData {
  name: string;
  uid?: string | null;
}

export function generateEch0217Xml(vatReturn: VatReturnData, company: CompanyData): string {
  const totalTax = vatReturn.steuer302 + vatReturn.steuer312 + vatReturn.steuer342 + vatReturn.steuer382;
  const totalInput = vatReturn.ziffer400 + vatReturn.ziffer405 + vatReturn.ziffer410 + vatReturn.ziffer415 - vatReturn.ziffer420;
  const zahllast = (totalTax - totalInput).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- eCH-0217 MwSt-Abrechnung — Placeholder -->
<!-- Firma: ${escapeXml(company.name)} -->
<!-- UID: ${escapeXml(company.uid || "nicht gesetzt")} -->
<!-- Periode: Q${vatReturn.quarter}/${vatReturn.year} -->
<!-- Status: ${vatReturn.status} -->
<!-- Zahllast: ${zahllast} CHF -->
<!-- TODO: Vollständige eCH-0217 Implementierung in Phase 9.3.3 -->
<eCH-0217:VATDeclaration
  xmlns:eCH-0217="http://www.ech.ch/xmlns/eCH-0217/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <eCH-0217:uid>${escapeXml(company.uid || "")}</eCH-0217:uid>
  <eCH-0217:organisationName>${escapeXml(company.name)}</eCH-0217:organisationName>
  <eCH-0217:taxPeriod>
    <eCH-0217:year>${vatReturn.year}</eCH-0217:year>
    <eCH-0217:period>${vatReturn.quarter}</eCH-0217:period>
    <eCH-0217:periodType>${vatReturn.periodType}</eCH-0217:periodType>
  </eCH-0217:taxPeriod>
  <eCH-0217:totalPayable>${zahllast}</eCH-0217:totalPayable>
  <!-- Placeholder: Vollständige Ziffern folgen in Phase 9.3.3 -->
</eCH-0217:VATDeclaration>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
