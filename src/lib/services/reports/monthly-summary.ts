import { prisma } from "@/lib/db";

// -- Types --

export interface MonthlySummary {
  companyId: string;
  companyName: string;
  year: number;
  month: number;
  generatedAt: string;

  overview: {
    totalDocuments: number;
    totalGrossAmount: number;
    totalVatAmount: number;
    avgDocumentAmount: number;
    currency: string;
  };

  comparison: {
    documentCountChange: number;
    grossAmountChange: number;
    grossAmountChangePercent: number;
    newSuppliers: number;
    trend: "up" | "down" | "stable";
  };

  topSuppliers: Array<{
    name: string;
    documentCount: number;
    totalAmount: number;
    percentOfTotal: number;
  }>;

  topAccounts: Array<{
    accountCode: string;
    accountName: string | null;
    totalAmount: number;
    documentCount: number;
  }>;

  anomalies: Array<{
    type: "amount_spike" | "new_supplier" | "missing_docs" | "unusual_vat" | "overdue_payment" | "account_change";
    message: string;
    severity: "info" | "warning";
    details?: Record<string, any>;
  }>;

  paymentStatus: {
    paidCount: number;
    unpaidCount: number;
    partialCount: number;
    totalUnpaid: number;
    overdueCount: number;
  };
}

// -- Main --

export async function generateMonthlySummary(
  companyId: string,
  year: number,
  month: number
): Promise<MonthlySummary> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 1));

  // 1. Company
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, currency: true },
  });

  // 2. Current month documents
  const docs = await prisma.document.findMany({
    where: {
      companyId,
      invoiceDate: { gte: monthStart, lt: monthEnd },
      status: { notIn: ["rejected", "failed"] },
    },
    select: {
      id: true, supplierNameNormalized: true, supplierId: true,
      grossAmount: true, vatAmount: true, netAmount: true,
      accountCode: true, vatRatesDetected: true, dueDate: true,
    },
  });

  // 3. Previous month documents (for comparison)
  const prevDocs = await prisma.document.findMany({
    where: {
      companyId,
      invoiceDate: { gte: prevMonthStart, lt: prevMonthEnd },
      status: { notIn: ["rejected", "failed"] },
    },
    select: {
      id: true, supplierNameNormalized: true, accountCode: true,
      grossAmount: true,
    },
  });

  // -- Overview --
  let totalGross = 0;
  let totalVat = 0;
  for (const d of docs) {
    totalGross += Number(d.grossAmount || 0);
    totalVat += Number(d.vatAmount || 0);
  }
  totalGross = round2(totalGross);
  totalVat = round2(totalVat);
  const avgAmount = docs.length > 0 ? round2(totalGross / docs.length) : 0;

  // -- Comparison --
  let prevTotalGross = 0;
  for (const d of prevDocs) prevTotalGross += Number(d.grossAmount || 0);
  prevTotalGross = round2(prevTotalGross);

  const docCountChange = docs.length - prevDocs.length;
  const grossChange = round2(totalGross - prevTotalGross);
  const grossChangePercent = prevTotalGross > 0
    ? round2((grossChange / prevTotalGross) * 100)
    : totalGross > 0 ? 100 : 0;

  const prevSupplierNames = new Set(prevDocs.map((d) => d.supplierNameNormalized).filter(Boolean));
  const currSupplierNames = new Set(docs.map((d) => d.supplierNameNormalized).filter(Boolean));
  const newSupplierNames = [...currSupplierNames].filter((n) => n && !prevSupplierNames.has(n));

  const trend: "up" | "down" | "stable" =
    grossChangePercent > 10 ? "up" : grossChangePercent < -10 ? "down" : "stable";

  // -- Top 5 Suppliers --
  const supplierTotals = new Map<string, { count: number; total: number }>();
  for (const d of docs) {
    const name = d.supplierNameNormalized || "Unbekannt";
    const entry = supplierTotals.get(name) || { count: 0, total: 0 };
    entry.count++;
    entry.total += Number(d.grossAmount || 0);
    supplierTotals.set(name, entry);
  }
  const topSuppliers = [...supplierTotals.entries()]
    .map(([name, data]) => ({
      name,
      documentCount: data.count,
      totalAmount: round2(data.total),
      percentOfTotal: totalGross > 0 ? round2((data.total / totalGross) * 100) : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  // -- Top 5 Accounts --
  const accountTotals = new Map<string, { count: number; total: number }>();
  for (const d of docs) {
    if (!d.accountCode) continue;
    const entry = accountTotals.get(d.accountCode) || { count: 0, total: 0 };
    entry.count++;
    entry.total += Number(d.grossAmount || 0);
    accountTotals.set(d.accountCode, entry);
  }
  const accountCodes = [...accountTotals.keys()];
  const dbAccounts = accountCodes.length > 0
    ? await prisma.account.findMany({
        where: { companyId, accountNumber: { in: accountCodes } },
        select: { accountNumber: true, name: true },
      })
    : [];
  const accountNameMap = new Map(dbAccounts.map((a) => [a.accountNumber, a.name]));

  const topAccounts = [...accountTotals.entries()]
    .map(([code, data]) => ({
      accountCode: code,
      accountName: accountNameMap.get(code) || null,
      totalAmount: round2(data.total),
      documentCount: data.count,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  // -- Anomalies --
  const anomalies: MonthlySummary["anomalies"] = [];

  // amount_spike: doc > 3x average
  if (avgAmount > 0) {
    for (const d of docs) {
      const amt = Number(d.grossAmount || 0);
      if (amt > avgAmount * 3) {
        anomalies.push({
          type: "amount_spike",
          message: "Beleg CHF " + round2(amt).toLocaleString("de-CH") + " von " + (d.supplierNameNormalized || "Unbekannt") + " (" + round2(amt / avgAmount).toFixed(1) + "x Durchschnitt)",
          severity: "warning",
          details: { amount: round2(amt), average: avgAmount, supplier: d.supplierNameNormalized },
        });
      }
    }
  }

  // new_supplier
  for (const name of newSupplierNames) {
    anomalies.push({
      type: "new_supplier",
      message: "Neuer Lieferant: " + name,
      severity: "info",
      details: { supplier: name },
    });
  }

  // missing_docs
  const period = await prisma.monthlyPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { documentsExpected: true, documentsReceived: true },
  });
  if (period && period.documentsExpected > 0) {
    const missing = period.documentsExpected - (period.documentsReceived || docs.length);
    if (missing > 0) {
      anomalies.push({
        type: "missing_docs",
        message: missing + " von " + period.documentsExpected + " erwarteten Belegen fehlen",
        severity: "warning",
        details: { expected: period.documentsExpected, missing },
      });
    }
  }

  // unusual_vat
  const standardRates = new Set([0, 2.5, 2.6, 3.7, 3.8, 7.7, 8.1]);
  for (const d of docs) {
    const rates = parseVatRates(d.vatRatesDetected);
    for (const r of rates) {
      if (r.rate > 0 && !standardRates.has(r.rate)) {
        anomalies.push({
          type: "unusual_vat",
          message: "MwSt-Satz " + r.rate + "% bei " + (d.supplierNameNormalized || "Unbekannt"),
          severity: "info",
          details: { rate: r.rate, supplier: d.supplierNameNormalized },
        });
        break; // one per doc is enough
      }
    }
  }

  // overdue_payment
  const matchedDocIds = new Set(
    (await prisma.bankTransaction.findMany({
      where: { companyId, matchedDocumentId: { not: null }, matchStatus: { in: ["auto_matched", "manual_matched"] } },
      select: { matchedDocumentId: true },
    })).map((t) => t.matchedDocumentId)
  );

  const overdueUnpaid = docs.filter(
    (d) => d.dueDate && d.dueDate < monthEnd && !matchedDocIds.has(d.id)
  );
  if (overdueUnpaid.length > 0) {
    let overdueTotal = 0;
    for (const d of overdueUnpaid) overdueTotal += Number(d.grossAmount || 0);
    anomalies.push({
      type: "overdue_payment",
      message: overdueUnpaid.length + " Rechnungen (CHF " + round2(overdueTotal).toLocaleString("de-CH") + ") per Monatsende unbezahlt",
      severity: "warning",
      details: { count: overdueUnpaid.length, total: round2(overdueTotal) },
    });
  }

  // account_change: supplier uses different account this month vs last month
  const prevSupplierAccounts = new Map<string, string>();
  for (const d of prevDocs) {
    if (d.supplierNameNormalized && d.accountCode) {
      prevSupplierAccounts.set(d.supplierNameNormalized, d.accountCode);
    }
  }
  const currSupplierAccounts = new Map<string, string>();
  for (const d of docs) {
    if (d.supplierNameNormalized && d.accountCode) {
      currSupplierAccounts.set(d.supplierNameNormalized, d.accountCode);
    }
  }
  for (const [name, currAccount] of currSupplierAccounts.entries()) {
    const prevAccount = prevSupplierAccounts.get(name);
    if (prevAccount && prevAccount !== currAccount) {
      anomalies.push({
        type: "account_change",
        message: name + ": Konto gewechselt von " + prevAccount + " auf " + currAccount,
        severity: "info",
        details: { supplier: name, previousAccount: prevAccount, currentAccount: currAccount },
      });
    }
  }

  // -- Payment Status --
  const paidDocs = docs.filter((d) => matchedDocIds.has(d.id));
  const unpaidDocs = docs.filter((d) => !matchedDocIds.has(d.id));
  let totalUnpaid = 0;
  for (const d of unpaidDocs) totalUnpaid += Number(d.grossAmount || 0);

  return {
    companyId,
    companyName: company.name,
    year,
    month,
    generatedAt: new Date().toISOString(),
    overview: {
      totalDocuments: docs.length,
      totalGrossAmount: totalGross,
      totalVatAmount: totalVat,
      avgDocumentAmount: avgAmount,
      currency: company.currency || "CHF",
    },
    comparison: {
      documentCountChange: docCountChange,
      grossAmountChange: grossChange,
      grossAmountChangePercent: grossChangePercent,
      newSuppliers: newSupplierNames.length,
      trend,
    },
    topSuppliers,
    topAccounts,
    anomalies,
    paymentStatus: {
      paidCount: paidDocs.length,
      unpaidCount: unpaidDocs.length,
      partialCount: 0,
      totalUnpaid: round2(totalUnpaid),
      overdueCount: overdueUnpaid.length,
    },
  };
}

// -- Helpers --

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseVatRates(vatRatesDetected: any): Array<{ rate: number }> {
  if (!vatRatesDetected || !Array.isArray(vatRatesDetected)) return [];
  return vatRatesDetected.filter((v: any) => v && typeof v.rate === "number");
}
