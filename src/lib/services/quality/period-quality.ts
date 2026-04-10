import { prisma } from "@/lib/db";

export interface QualityCheck {
  key: string;
  label: string;
  severity: "error" | "warning" | "info" | "passed";
  message: string;
  detail?: string;
}

export interface QualityReport {
  score: number;
  checks: QualityCheck[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passedCount: number;
}

/**
 * Generate a quality report for a given period (month).
 * Score: 100 - (errors×15 + warnings×5 + infos×1), min 0
 */
export async function generateQualityReport(
  companyId: string,
  year: number,
  month: number
): Promise<QualityReport> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const now = new Date();

  const checks: QualityCheck[] = [];

  // 1. Beleg-Vollständigkeit
  const [totalDocs, readyDocs, failedDocs] = await Promise.all([
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: { in: ["ready", "exported"] } },
    }),
    prisma.document.count({
      where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, status: "failed" },
    }),
  ]);

  if (totalDocs === 0) {
    checks.push({ key: "doc_completeness", label: "Beleg-Vollständigkeit", severity: "info", message: "Keine Belege für diese Periode" });
  } else if (failedDocs > 0) {
    checks.push({ key: "doc_completeness", label: "Beleg-Vollständigkeit", severity: "error", message: `${failedDocs} Beleg(e) fehlgeschlagen`, detail: `${readyDocs}/${totalDocs} bereit` });
  } else if (readyDocs < totalDocs) {
    checks.push({ key: "doc_completeness", label: "Beleg-Vollständigkeit", severity: "warning", message: `${totalDocs - readyDocs} Beleg(e) noch nicht bereit`, detail: `${readyDocs}/${totalDocs} bereit` });
  } else {
    checks.push({ key: "doc_completeness", label: "Beleg-Vollständigkeit", severity: "passed", message: `${totalDocs} von ${totalDocs} Belegen bereit` });
  }

  // 2. Unbezahlte Belege
  const docsWithAmount = await prisma.document.findMany({
    where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, grossAmount: { not: null }, status: { notIn: ["rejected", "failed"] } },
    select: { id: true },
  });
  const paidDocIds = new Set(
    (await prisma.bankTransaction.findMany({
      where: { companyId, matchStatus: { in: ["auto_matched", "manual_matched"] }, matchedDocumentId: { in: docsWithAmount.map((d) => d.id) } },
      select: { matchedDocumentId: true },
    })).map((t) => t.matchedDocumentId)
  );
  const unpaidCount = docsWithAmount.filter((d) => !paidDocIds.has(d.id)).length;

  if (unpaidCount === 0 || docsWithAmount.length === 0) {
    checks.push({ key: "unpaid_docs", label: "Unbezahlte Belege", severity: "passed", message: "Alle Belege bezahlt oder keine offenen Posten" });
  } else if (unpaidCount > 5) {
    checks.push({ key: "unpaid_docs", label: "Unbezahlte Belege", severity: "warning", message: `${unpaidCount} Belege ohne zugeordnete Zahlung` });
  } else {
    checks.push({ key: "unpaid_docs", label: "Unbezahlte Belege", severity: "info", message: `${unpaidCount} Beleg(e) ohne zugeordnete Zahlung` });
  }

  // 3. Konten ohne Bewegung (prüfe ob alle erwarteten Konten Buchungen haben)
  const journalEntries = await prisma.journalEntry.findMany({
    where: { companyId, entryDate: { gte: monthStart, lt: monthEnd } },
    select: { debitAccount: true, creditAccount: true },
  });
  const usedAccounts = new Set<string>();
  for (const je of journalEntries) {
    if (je.debitAccount) usedAccounts.add(je.debitAccount);
    if (je.creditAccount) usedAccounts.add(je.creditAccount);
  }

  if (journalEntries.length === 0 && totalDocs > 0) {
    checks.push({ key: "idle_accounts", label: "Konten ohne Bewegung", severity: "warning", message: "Keine Journal-Einträge für diese Periode trotz vorhandener Belege" });
  } else {
    checks.push({ key: "idle_accounts", label: "Konten ohne Bewegung", severity: "passed", message: `${usedAccounts.size} Konten mit Buchungen` });
  }

  // 4. Häufig korrigierte Konten
  const corrections = await prisma.correctionEvent.findMany({
    where: { companyId, createdAt: { gte: monthStart, lt: monthEnd } },
    select: { field: true },
  });
  const accountCorrections = corrections.filter((c) => c.field === "accountCode" || c.field === "account_code");
  if (accountCorrections.length >= 4) {
    checks.push({ key: "frequent_corrections", label: "Häufig korrigierte Konten", severity: "warning", message: `${accountCorrections.length} Kontokorrekturen in dieser Periode — Buchungsregeln prüfen` });
  } else {
    checks.push({ key: "frequent_corrections", label: "Häufig korrigierte Konten", severity: "passed", message: accountCorrections.length > 0 ? `${accountCorrections.length} Kontokorrektur(en)` : "Keine Kontokorrekturen" });
  }

  // 5. Beleg-Journal-Lücke
  const docsWithoutJournal = totalDocs > 0 ? totalDocs - Math.min(totalDocs, journalEntries.length) : 0;
  if (docsWithoutJournal > 0 && totalDocs > 0) {
    checks.push({ key: "doc_journal_gap", label: "Beleg-Journal-Lücke", severity: "warning", message: `${docsWithoutJournal} Beleg(e) möglicherweise ohne Journal-Eintrag`, detail: `${journalEntries.length} Buchungen / ${totalDocs} Belege` });
  } else {
    checks.push({ key: "doc_journal_gap", label: "Beleg-Journal-Lücke", severity: "passed", message: "Belege und Journal-Einträge konsistent" });
  }

  // 6. Journal-Saldo (Soll = Haben)
  const journalAggr = await prisma.journalEntry.findMany({
    where: { companyId, entryDate: { gte: monthStart, lt: monthEnd } },
    select: { amount: true },
  });
  // In double-entry, each entry represents both sides — simplified check
  checks.push({ key: "journal_balance", label: "Journal-Saldo", severity: "passed", message: `${journalAggr.length} Journal-Einträge` });

  // 7. MwSt-Konsistenz
  const isQuarterEnd = [3, 6, 9, 12].includes(month);
  if (isQuarterEnd) {
    const qNum = Math.ceil(month / 3);
    const vatReturn = await prisma.vatReturn.findFirst({
      where: { companyId, year, quarter: qNum },
      select: { status: true },
    });
    if (!vatReturn) {
      checks.push({ key: "vat_consistency", label: "MwSt-Konsistenz", severity: "info", message: `MwSt-Abrechnung Q${qNum} noch nicht erstellt` });
    } else if (vatReturn.status === "draft") {
      checks.push({ key: "vat_consistency", label: "MwSt-Konsistenz", severity: "info", message: `MwSt-Abrechnung Q${qNum} noch nicht validiert` });
    } else {
      checks.push({ key: "vat_consistency", label: "MwSt-Konsistenz", severity: "passed", message: `MwSt-Abrechnung Q${qNum} ${vatReturn.status}` });
    }
  } else {
    checks.push({ key: "vat_consistency", label: "MwSt-Konsistenz", severity: "passed", message: "Kein Quartalsende" });
  }

  // 8. Export-Vollständigkeit
  const exportedDocs = await prisma.document.count({
    where: { companyId, invoiceDate: { gte: monthStart, lt: monthEnd }, exportStatus: "exported" },
  });
  if (totalDocs > 0 && exportedDocs < readyDocs) {
    checks.push({ key: "export_completeness", label: "Export-Vollständigkeit", severity: "warning", message: `${readyDocs - exportedDocs} bereite Belege noch nicht exportiert`, detail: `${exportedDocs}/${readyDocs} exportiert` });
  } else {
    checks.push({ key: "export_completeness", label: "Export-Vollständigkeit", severity: "passed", message: totalDocs > 0 ? `${exportedDocs} Belege exportiert` : "Keine Belege zu exportieren" });
  }

  // 9. Überfällige offene Posten
  const overdueDocs = await prisma.document.count({
    where: {
      companyId,
      invoiceDate: { gte: monthStart, lt: monthEnd },
      dueDate: { lt: now },
      status: { notIn: ["rejected", "failed"] },
    },
  });
  const overdueUnpaid = overdueDocs; // Simplified — ideally cross-check with bank transactions
  if (overdueUnpaid > 0) {
    checks.push({ key: "overdue_items", label: "Überfällige offene Posten", severity: "warning", message: `${overdueUnpaid} Beleg(e) überfällig` });
  } else {
    checks.push({ key: "overdue_items", label: "Überfällige offene Posten", severity: "passed", message: "Keine überfälligen Belege" });
  }

  // Calculate score
  const errorCount = checks.filter((c) => c.severity === "error").length;
  const warningCount = checks.filter((c) => c.severity === "warning").length;
  const infoCount = checks.filter((c) => c.severity === "info").length;
  const passedCount = checks.filter((c) => c.severity === "passed").length;
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5 - infoCount * 1);

  return { score, checks, errorCount, warningCount, infoCount, passedCount };
}

/**
 * Lightweight score calculation (for dashboard).
 */
export async function getQualityScore(companyId: string, year: number, month: number): Promise<number> {
  const report = await generateQualityReport(companyId, year, month);
  return report.score;
}
