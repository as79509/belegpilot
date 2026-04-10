import { jsPDF } from "jspdf";

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
  documentCount: number;
}

interface CompanyData {
  name: string;
  uid?: string | null;
  vatNumber?: string | null;
}

function fmtAmount(val: number): string {
  return val.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate a PDF matching the Swiss VAT Form 405 layout.
 */
export function generateVatPdf(vr: VatReturnData, company: CompanyData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 190; // usable page width (210 - 2*10 margin)
  let y = 15;

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Mehrwertsteuer-Abrechnung", 10, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Firma: ${company.name}`, 10, y);
  y += 5;
  if (company.uid) {
    doc.text(`UID: ${company.uid}`, 10, y);
    y += 5;
  }

  const periodLabel = vr.periodType === "semi_annual"
    ? `Halbjahr ${vr.quarter}/${vr.year}`
    : `Quartal ${vr.quarter}/${vr.year}`;
  doc.text(`Periode: ${periodLabel}`, 10, y);
  y += 5;
  doc.text(`Belege: ${vr.documentCount}`, 10, y);
  y += 3;

  // Separator
  y += 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(10, y, 200, y);
  y += 6;

  // ── Section I: Umsatz ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("I. Umsatz", 10, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Ziffer", 10, y);
  doc.text("Bezeichnung", 30, y);
  doc.text("CHF", 190, y, { align: "right" });
  y += 1;
  doc.setLineWidth(0.2);
  doc.line(10, y, 200, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  const revenueRows: [string, string, number][] = [
    ["200", "Gesamtbetrag der Entgelte", vr.ziffer200],
    ["205", "Nicht steuerbare Leistungen", vr.ziffer205],
    ["220", "Steuerbefreite Leistungen", vr.ziffer220],
    ["221", "Leistungen im Ausland", vr.ziffer221],
    ["225", "Entgeltsminderungen", vr.ziffer225],
    ["230", "Subventionen", vr.ziffer230],
    ["235", "Diverses", vr.ziffer235],
  ];

  for (const [z, label, val] of revenueRows) {
    doc.text(z, 12, y);
    doc.text(label, 30, y);
    doc.text(fmtAmount(val), 190, y, { align: "right" });
    y += 5;
  }

  const taxableRevenue = vr.ziffer200 - vr.ziffer205 - vr.ziffer220 - vr.ziffer221 - vr.ziffer225 - vr.ziffer230 - vr.ziffer235;
  doc.setFont("helvetica", "bold");
  doc.text("Steuerbarer Gesamtumsatz", 30, y);
  doc.text(fmtAmount(taxableRevenue), 190, y, { align: "right" });
  y += 8;

  // ── Section II: Steuerberechnung ──
  doc.setFontSize(11);
  doc.text("II. Steuerberechnung", 10, y);
  y += 6;

  doc.setFontSize(9);
  doc.text("Ziffer", 10, y);
  doc.text("Bezeichnung", 30, y);
  doc.text("Umsatz", 150, y, { align: "right" });
  doc.text("Steuer", 190, y, { align: "right" });
  y += 1;
  doc.line(10, y, 200, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  const taxRows: [string, string, number, number][] = [
    ["302", "Normalsatz 8.1%", vr.ziffer302, vr.steuer302],
    ["312", "Reduzierter Satz 2.6%", vr.ziffer312, vr.steuer312],
    ["342", "Sondersatz 3.8%", vr.ziffer342, vr.steuer342],
    ["382", "Bezugsteuer", vr.ziffer382, vr.steuer382],
  ];

  for (const [z, label, base, tax] of taxRows) {
    doc.text(z, 12, y);
    doc.text(label, 30, y);
    doc.text(fmtAmount(base), 150, y, { align: "right" });
    doc.text(fmtAmount(tax), 190, y, { align: "right" });
    y += 5;
  }

  const totalTax = vr.steuer302 + vr.steuer312 + vr.steuer342 + vr.steuer382;
  doc.setFont("helvetica", "bold");
  doc.text("Total geschuldete Steuer", 30, y);
  doc.text(fmtAmount(totalTax), 190, y, { align: "right" });
  y += 8;

  // ── Section III: Vorsteuer ──
  doc.setFontSize(11);
  doc.text("III. Vorsteuer", 10, y);
  y += 6;

  doc.setFontSize(9);
  doc.text("Ziffer", 10, y);
  doc.text("Bezeichnung", 30, y);
  doc.text("CHF", 190, y, { align: "right" });
  y += 1;
  doc.line(10, y, 200, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  const inputRows: [string, string, number][] = [
    ["400", "Material/DL", vr.ziffer400],
    ["405", "Investitionen", vr.ziffer405],
    ["410", "Einlageentsteuerung", vr.ziffer410],
    ["415", "Korrekturen", vr.ziffer415],
    ["420", "Kürzungen", vr.ziffer420],
  ];

  for (const [z, label, val] of inputRows) {
    doc.text(z, 12, y);
    doc.text(label, 30, y);
    doc.text(fmtAmount(val), 190, y, { align: "right" });
    y += 5;
  }

  const totalInput = vr.ziffer400 + vr.ziffer405 + vr.ziffer410 + vr.ziffer415 - vr.ziffer420;
  doc.setFont("helvetica", "bold");
  doc.text("Total Vorsteuerabzug", 30, y);
  doc.text(fmtAmount(totalInput), 190, y, { align: "right" });
  y += 10;

  // ── Result ──
  const payable = totalTax - totalInput;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  if (payable >= 0) {
    doc.text(`Zu bezahlender Betrag: CHF ${fmtAmount(payable)}`, 10, y);
  } else {
    doc.text(`Guthaben: CHF ${fmtAmount(Math.abs(payable))}`, 10, y);
  }
  y += 12;

  // ── Footer ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128, 128, 128);
  doc.text(`Erstellt mit BelegPilot · ${new Date().toLocaleDateString("de-CH")}`, 10, 285);

  return Buffer.from(doc.output("arraybuffer"));
}
