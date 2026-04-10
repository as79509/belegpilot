import { prisma } from "@/lib/db";

// -- Types --

export interface OnboardingAnalysis {
  companyId: string;
  analyzedDocuments: number;
  generatedAt: string;
  suppliers: SupplierAnalysis[];
  accountPatterns: AccountPattern[];
  vatDistribution: VatEntry[];
  suggestedRules: SuggestedRule[];
  uncertainties: {
    confirmed: string[];
    unclear: string[];
    needsReview: string[];
  };
}

export interface SupplierAnalysis {
  name: string;
  documentCount: number;
  totalAmount: number;
  suggestedCategory: string | null;
  suggestedAccount: string | null;
  confidence: "high" | "medium" | "low";
  existsInSystem: boolean;
}

export interface AccountPattern {
  accountCode: string;
  accountName: string | null;
  documentCount: number;
  totalAmount: number;
  topSuppliers: string[];
  confidence: "high" | "medium" | "low";
}

export interface VatEntry {
  rate: number;
  documentCount: number;
  totalVat: number;
  totalNet: number;
}

export interface SuggestedRule {
  type: "supplier_to_account" | "category_mapping" | "vat_default";
  description: string;
  supplierName?: string;
  accountCode?: string;
  category?: string;
  confidence: "high" | "medium" | "low";
  basedOnCount: number;
}

// -- Main --

export async function analyzeNewClient(companyId: string): Promise<OnboardingAnalysis> {
  const documents = await prisma.document.findMany({
    where: { companyId, status: { notIn: ["rejected", "failed"] } },
    orderBy: { invoiceDate: "desc" },
    take: 50,
    select: {
      id: true, supplierNameNormalized: true, supplierId: true,
      grossAmount: true, netAmount: true, vatAmount: true,
      vatRatesDetected: true, accountCode: true, expenseCategory: true,
    },
  });

  // 1. Supplier recognition
  const supplierMap = new Map<string, { count: number; total: number; accounts: Map<string, number>; categories: Map<string, number> }>();
  for (const doc of documents) {
    const name = doc.supplierNameNormalized;
    if (!name) continue;
    const entry = supplierMap.get(name) || { count: 0, total: 0, accounts: new Map(), categories: new Map() };
    entry.count++;
    entry.total += Number(doc.grossAmount || 0);
    if (doc.accountCode) entry.accounts.set(doc.accountCode, (entry.accounts.get(doc.accountCode) || 0) + 1);
    if (doc.expenseCategory) entry.categories.set(doc.expenseCategory, (entry.categories.get(doc.expenseCategory) || 0) + 1);
    supplierMap.set(name, entry);
  }

  const existingSuppliers = await prisma.supplier.findMany({
    where: { companyId }, select: { nameNormalized: true },
  });
  const existingNames = new Set(existingSuppliers.map((s) => s.nameNormalized.toLowerCase()));

  const suppliers: SupplierAnalysis[] = [...supplierMap.entries()].map(([name, data]) => ({
    name,
    documentCount: data.count,
    totalAmount: Math.round(data.total * 100) / 100,
    suggestedAccount: getTopKey(data.accounts),
    suggestedCategory: getTopKey(data.categories),
    confidence: (data.count >= 5 ? "high" : data.count >= 3 ? "medium" : "low") as "high" | "medium" | "low",
    existsInSystem: existingNames.has(name.toLowerCase()),
  })).sort((a, b) => b.documentCount - a.documentCount);

  // 2. Account patterns
  const accountMap = new Map<string, { count: number; total: number; suppliers: Map<string, number> }>();
  for (const doc of documents) {
    if (!doc.accountCode) continue;
    const entry = accountMap.get(doc.accountCode) || { count: 0, total: 0, suppliers: new Map() };
    entry.count++;
    entry.total += Number(doc.grossAmount || 0);
    if (doc.supplierNameNormalized) entry.suppliers.set(doc.supplierNameNormalized, (entry.suppliers.get(doc.supplierNameNormalized) || 0) + 1);
    accountMap.set(doc.accountCode, entry);
  }

  const accountCodes = [...accountMap.keys()];
  const dbAccounts = accountCodes.length > 0
    ? await prisma.account.findMany({ where: { companyId, accountNumber: { in: accountCodes } }, select: { accountNumber: true, name: true } })
    : [];
  const accountNameMap = new Map(dbAccounts.map((a) => [a.accountNumber, a.name]));

  const accountPatterns: AccountPattern[] = [...accountMap.entries()].map(([code, data]) => ({
    accountCode: code,
    accountName: accountNameMap.get(code) || null,
    documentCount: data.count,
    totalAmount: Math.round(data.total * 100) / 100,
    topSuppliers: getTopKeys(data.suppliers, 3),
    confidence: (data.count >= 5 ? "high" : data.count >= 3 ? "medium" : "low") as "high" | "medium" | "low",
  })).sort((a, b) => b.documentCount - a.documentCount);

  // 3. VAT distribution
  const vatMap = new Map<number, { count: number; totalVat: number; totalNet: number }>();
  for (const doc of documents) {
    const rates = parseVatRates(doc.vatRatesDetected);
    if (rates.length > 0) {
      for (const r of rates) {
        const entry = vatMap.get(r.rate) || { count: 0, totalVat: 0, totalNet: 0 };
        entry.count++;
        entry.totalVat += r.amount || 0;
        entry.totalNet += r.base || 0;
        vatMap.set(r.rate, entry);
      }
    } else if (doc.vatAmount && Number(doc.vatAmount) > 0) {
      const rate = doc.netAmount && Number(doc.netAmount) > 0
        ? Math.round((Number(doc.vatAmount) / Number(doc.netAmount)) * 1000) / 10 : 0;
      const entry = vatMap.get(rate) || { count: 0, totalVat: 0, totalNet: 0 };
      entry.count++;
      entry.totalVat += Number(doc.vatAmount);
      entry.totalNet += Number(doc.netAmount || 0);
      vatMap.set(rate, entry);
    }
  }

  const vatDistribution: VatEntry[] = [...vatMap.entries()]
    .map(([rate, data]) => ({ rate, documentCount: data.count, totalVat: Math.round(data.totalVat * 100) / 100, totalNet: Math.round(data.totalNet * 100) / 100 }))
    .sort((a, b) => b.documentCount - a.documentCount);

  // 4. Suggested rules
  const suggestedRules: SuggestedRule[] = [];

  for (const [name, data] of supplierMap.entries()) {
    const topAccount = getTopKey(data.accounts);
    const topCount = topAccount ? data.accounts.get(topAccount) || 0 : 0;
    if (topAccount && topCount >= 3) {
      suggestedRules.push({
        type: "supplier_to_account", description: name + " \u2192 Konto " + topAccount,
        supplierName: name, accountCode: topAccount,
        confidence: topCount >= 5 ? "high" : "medium", basedOnCount: topCount,
      });
    }
  }

  const categoryAccountMap = new Map<string, Map<string, number>>();
  for (const doc of documents) {
    if (!doc.expenseCategory || !doc.accountCode) continue;
    const acctMap = categoryAccountMap.get(doc.expenseCategory) || new Map();
    acctMap.set(doc.accountCode, (acctMap.get(doc.accountCode) || 0) + 1);
    categoryAccountMap.set(doc.expenseCategory, acctMap);
  }
  for (const [category, acctMap] of categoryAccountMap.entries()) {
    const topAccount = getTopKey(acctMap);
    const topCount = topAccount ? acctMap.get(topAccount) || 0 : 0;
    if (topAccount && topCount >= 3) {
      suggestedRules.push({
        type: "category_mapping", description: category + " \u2192 Konto " + topAccount,
        category, accountCode: topAccount,
        confidence: topCount >= 5 ? "high" : "medium", basedOnCount: topCount,
      });
    }
  }

  const totalDocsWithVat = [...vatMap.values()].reduce((s, v) => s + v.count, 0);
  if (totalDocsWithVat > 0) {
    const topVat = [...vatMap.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    if (topVat && topVat[1].count / totalDocsWithVat >= 0.8) {
      suggestedRules.push({
        type: "vat_default", description: "Standard-MwSt-Satz: " + topVat[0] + "%",
        confidence: topVat[1].count / totalDocsWithVat >= 0.9 ? "high" : "medium",
        basedOnCount: topVat[1].count,
      });
    }
  }

  // 5. Uncertainties
  const confirmed: string[] = [];
  const unclear: string[] = [];
  const needsReview: string[] = [];

  if (suppliers.length > 0) confirmed.push(suppliers.length + " Lieferanten erkannt");
  if (vatDistribution.length > 0 && vatDistribution[0].rate > 0) confirmed.push("Haupt-MwSt-Satz: " + vatDistribution[0].rate + "%");
  const highConfAccounts = accountPatterns.filter((a) => a.confidence === "high");
  if (highConfAccounts.length > 0) confirmed.push(highConfAccounts.length + " Konten mit hoher Konfidenz");

  const singleDocSuppliers = suppliers.filter((s) => s.documentCount === 1);
  if (singleDocSuppliers.length > 0) unclear.push(singleDocSuppliers.length + " Lieferanten mit nur 1 Beleg");
  const docsWithoutAccount = documents.filter((d) => !d.accountCode).length;
  if (docsWithoutAccount > 0) unclear.push(docsWithoutAccount + " Belege ohne Kontierung");
  const lowConfAccounts = accountPatterns.filter((a) => a.confidence === "low");
  if (lowConfAccounts.length > 0) unclear.push(lowConfAccounts.length + " Konten mit niedriger Konfidenz");

  const lowConfSuppliers = suppliers.filter((s) => s.confidence === "low" && !s.existsInSystem);
  if (lowConfSuppliers.length > 0) needsReview.push(lowConfSuppliers.length + " neue Lieferanten mit niedriger Konfidenz");
  const missingAccounts = accountCodes.filter((c) => !accountNameMap.has(c));
  if (missingAccounts.length > 0) needsReview.push(missingAccounts.length + " verwendete Konten fehlen im Kontenplan");
  const unusualVat = vatDistribution.filter((v) => v.rate > 0 && ![2.5, 2.6, 3.7, 3.8, 7.7, 8.1].includes(v.rate));
  if (unusualVat.length > 0) needsReview.push(unusualVat.length + " ungew\u00f6hnliche MwSt-S\u00e4tze erkannt");

  return {
    companyId, analyzedDocuments: documents.length, generatedAt: new Date().toISOString(),
    suppliers, accountPatterns, vatDistribution, suggestedRules,
    uncertainties: { confirmed, unclear, needsReview },
  };
}

// -- Helpers --

function getTopKey(map: Map<string, number>): string | null {
  let topKey: string | null = null, topCount = 0;
  for (const [key, count] of map.entries()) { if (count > topCount) { topKey = key; topCount = count; } }
  return topKey;
}

function getTopKeys(map: Map<string, number>, n: number): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key]) => key);
}

function parseVatRates(vatRatesDetected: any): Array<{ rate: number; amount?: number; base?: number }> {
  if (!vatRatesDetected || !Array.isArray(vatRatesDetected)) return [];
  return vatRatesDetected.filter((v: any) => v && typeof v.rate === "number");
}
