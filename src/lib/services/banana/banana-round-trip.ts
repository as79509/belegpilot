import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export interface RoundTripImportResult {
  totalRows: number;
  matched: number;
  modified: number;
  newInBanana: number;
  unmatched: number;
  importBatchId: string;
  deltas: Array<{
    journalEntryId: string | null;
    field: string;
    bpValue: string | null;
    bananaValue: string | null;
  }>;
  learnSignals: Array<{
    type: "account_change" | "vat_change" | "amount_change" | "description_change";
    message: string;
    frequency: number;
    suggestRuleUpdate: boolean;
  }>;
}

export interface RoundTripBatchSummary {
  importBatchId: string;
  importedAt: string;
  totalRows: number;
  matched: number;
  modified: number;
  newInBanana: number;
  unmatched: number;
}

interface BananaRow {
  date: Date | null;
  doc: string | null;
  description: string | null;
  debitAccount: string | null;
  creditAccount: string | null;
  amount: number | null;
  vatCode: string | null;
  vatAmount: number | null;
}

function parseBananaCSV(csvContent: string): BananaRow[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows: BananaRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 6) continue;
    const dateStr = cols[0];
    let date: Date | null = null;
    if (dateStr) {
      if (dateStr.includes(".")) {
        const parts = dateStr.split(".");
        date = new Date(parts[2] + "-" + parts[1] + "-" + parts[0]);
      } else {
        date = new Date(dateStr);
      }
      if (isNaN(date.getTime())) date = null;
    }
    rows.push({
      date,
      doc: cols[1] || null,
      description: cols[2] || null,
      debitAccount: cols[3] || null,
      creditAccount: cols[4] || null,
      amount: cols[5] ? parseFloat(cols[5].replace(",", ".")) : null,
      vatCode: cols[6] || null,
      vatAmount: cols[7] ? parseFloat(cols[7].replace(",", ".")) : null,
    });
  }
  return rows;
}

interface Delta {
  field: string;
  bpValue: string | null;
  bananaValue: string | null;
}

function compareFields(
  journal: { debitAccount: string; creditAccount: string; amount: number; vatAmount: number | null },
  banana: BananaRow,
  accountMap: Map<string, string>
): Delta[] {
  const deltas: Delta[] = [];
  if (banana.debitAccount && journal.debitAccount !== banana.debitAccount) {
    const mapped = accountMap.get(banana.debitAccount);
    if (!mapped || mapped !== journal.debitAccount) {
      deltas.push({ field: "debitAccount", bpValue: journal.debitAccount, bananaValue: banana.debitAccount });
    }
  }
  if (banana.creditAccount && journal.creditAccount !== banana.creditAccount) {
    const mapped = accountMap.get(banana.creditAccount);
    if (!mapped || mapped !== journal.creditAccount) {
      deltas.push({ field: "creditAccount", bpValue: journal.creditAccount, bananaValue: banana.creditAccount });
    }
  }
  if (banana.amount != null && Math.abs(journal.amount - banana.amount) > 0.01) {
    deltas.push({ field: "amount", bpValue: journal.amount.toFixed(2), bananaValue: banana.amount.toFixed(2) });
  }
  if (banana.vatAmount != null && journal.vatAmount != null && Math.abs(journal.vatAmount - banana.vatAmount) > 0.01) {
    deltas.push({ field: "vatAmount", bpValue: journal.vatAmount.toFixed(2), bananaValue: banana.vatAmount.toFixed(2) });
  }
  return deltas;
}

export async function importBananaFile(companyId: string, csvContent: string): Promise<RoundTripImportResult> {
  const rows = parseBananaCSV(csvContent);
  const importBatchId = randomUUID();

  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: { accountNumber: true, bananaAccountNumber: true },
  });
  const accountMap = new Map<string, string>();
  for (const acc of accounts) {
    if (acc.bananaAccountNumber) accountMap.set(acc.bananaAccountNumber, acc.accountNumber);
    accountMap.set(acc.accountNumber, acc.accountNumber);
  }

  const journalEntries = await prisma.journalEntry.findMany({
    where: { companyId },
    select: { id: true, reference: true, documentId: true, entryDate: true, debitAccount: true, creditAccount: true, amount: true, vatAmount: true, description: true },
    orderBy: { entryDate: "desc" },
    take: 5000,
  });

  const documents = await prisma.document.findMany({
    where: { companyId, documentNumber: { not: null } },
    select: { id: true, documentNumber: true },
  });
  const docNumberMap = new Map(documents.filter((d) => d.documentNumber).map((d) => [d.documentNumber!, d.id]));

  let matched = 0;
  let modified = 0;
  let newInBanana = 0;
  let unmatched = 0;
  const allDeltas: RoundTripImportResult["deltas"] = [];

  type EntryData = Parameters<typeof prisma.bananaRoundTripEntry.create>[0]["data"];
  const entriesToCreate: EntryData[] = [];

  for (const row of rows) {
    let matchedEntry: (typeof journalEntries)[0] | null = null;
    let matchMethod: string | null = null;
    let matchConfidence: number | null = null;

    // Stufe 1: Reference match
    if (row.doc && !matchedEntry) {
      const byRef = journalEntries.find((je) => je.reference && je.reference === row.doc);
      if (byRef) { matchedEntry = byRef; matchMethod = "reference"; matchConfidence = 1.0; }
    }
    // Stufe 2: Doc number match
    if (row.doc && !matchedEntry) {
      const docId = docNumberMap.get(row.doc);
      if (docId) {
        const byDocNum = journalEntries.find((je) => je.documentId === docId);
        if (byDocNum) { matchedEntry = byDocNum; matchMethod = "doc_number"; matchConfidence = 0.95; }
      }
    }
    // Stufe 3: Fallback
    if (!matchedEntry && row.date && row.amount != null) {
      const byFallback = journalEntries.find((je) => {
        if (!je.entryDate) return false;
        const dateMatch = je.entryDate.toISOString().slice(0, 10) === row.date!.toISOString().slice(0, 10);
        if (!dateMatch) return false;
        const amountMatch = Math.abs(Number(je.amount) - row.amount!) <= 0.01;
        if (!amountMatch) return false;
        const debitOk = !row.debitAccount || je.debitAccount === row.debitAccount || je.debitAccount === accountMap.get(row.debitAccount || "");
        const creditOk = !row.creditAccount || je.creditAccount === row.creditAccount || je.creditAccount === accountMap.get(row.creditAccount || "");
        return debitOk && creditOk;
      });
      if (byFallback) { matchedEntry = byFallback; matchMethod = "amount_date"; matchConfidence = 0.7; }
    }

    let matchStatus: string;
    let deltas: Delta[] = [];
    let documentId: string | null = null;

    if (matchedEntry) {
      documentId = matchedEntry.documentId;
      deltas = compareFields(
        { debitAccount: matchedEntry.debitAccount, creditAccount: matchedEntry.creditAccount, amount: Number(matchedEntry.amount), vatAmount: matchedEntry.vatAmount ? Number(matchedEntry.vatAmount) : null },
        row, accountMap
      );
      if (deltas.length > 0) {
        matchStatus = "modified"; modified++;
        for (const d of deltas) { allDeltas.push({ journalEntryId: matchedEntry.id, field: d.field, bpValue: d.bpValue, bananaValue: d.bananaValue }); }
      } else { matchStatus = "matched"; matched++; }
    } else if (row.doc || (row.amount != null && row.debitAccount)) {
      matchStatus = "new_in_banana"; newInBanana++;
    } else { matchStatus = "unmatched"; unmatched++; }

    entriesToCreate.push({
      companyId, journalEntryId: matchedEntry?.id ?? null, documentId, matchStatus, matchConfidence, matchMethod,
      bananaDate: row.date, bananaDoc: row.doc, bananaDescription: row.description,
      bananaDebitAccount: row.debitAccount, bananaCreditAccount: row.creditAccount,
      bananaAmount: row.amount, bananaVatCode: row.vatCode, bananaVatAmount: row.vatAmount,
      deltas: deltas.length > 0 ? JSON.parse(JSON.stringify(deltas)) : undefined, deltaCount: deltas.length, importBatchId,
    });
  }

  for (const data of entriesToCreate) { await prisma.bananaRoundTripEntry.create({ data }); }
  const learnSignals = await generateLearnSignals(companyId, allDeltas);
  return { totalRows: rows.length, matched, modified, newInBanana, unmatched, importBatchId, deltas: allDeltas, learnSignals };
}

export async function listBananaImportBatches(companyId: string): Promise<RoundTripBatchSummary[]> {
  const entries = await prisma.bananaRoundTripEntry.findMany({
    where: { companyId },
    select: {
      importBatchId: true,
      importedAt: true,
      matchStatus: true,
    },
    orderBy: { importedAt: "desc" },
    take: 1000,
  });

  const batches = new Map<string, RoundTripBatchSummary>();

  for (const entry of entries) {
    if (!batches.has(entry.importBatchId)) {
      batches.set(entry.importBatchId, {
        importBatchId: entry.importBatchId,
        importedAt: entry.importedAt.toISOString(),
        totalRows: 0,
        matched: 0,
        modified: 0,
        newInBanana: 0,
        unmatched: 0,
      });
    }

    const batch = batches.get(entry.importBatchId)!;
    batch.totalRows += 1;

    if (entry.matchStatus === "matched") batch.matched += 1;
    if (entry.matchStatus === "modified") batch.modified += 1;
    if (entry.matchStatus === "new_in_banana") batch.newInBanana += 1;
    if (entry.matchStatus === "unmatched") batch.unmatched += 1;
  }

  return [...batches.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

async function generateLearnSignals(companyId: string, currentDeltas: RoundTripImportResult["deltas"]): Promise<RoundTripImportResult["learnSignals"]> {
  const signals: RoundTripImportResult["learnSignals"] = [];
  if (currentDeltas.length === 0) return signals;

  const historicalEntries = await prisma.bananaRoundTripEntry.findMany({
    where: { companyId, matchStatus: "modified", deltaCount: { gt: 0 } },
    select: { deltas: true }, take: 1000,
  });

  const fieldChangeCounts: Record<string, Record<string, number>> = {};
  for (const entry of historicalEntries) {
    const deltas = entry.deltas as Delta[] | null;
    if (!deltas) continue;
    for (const d of deltas) {
      const key = (d.bpValue || "") + "->" + (d.bananaValue || "");
      if (!fieldChangeCounts[d.field]) fieldChangeCounts[d.field] = {};
      fieldChangeCounts[d.field][key] = (fieldChangeCounts[d.field][key] || 0) + 1;
    }
  }
  for (const d of currentDeltas) {
    const key = (d.bpValue || "") + "->" + (d.bananaValue || "");
    if (!fieldChangeCounts[d.field]) fieldChangeCounts[d.field] = {};
    fieldChangeCounts[d.field][key] = (fieldChangeCounts[d.field][key] || 0) + 1;
  }

  for (const [field, changes] of Object.entries(fieldChangeCounts)) {
    for (const [change, count] of Object.entries(changes)) {
      if (count < 3) continue;
      const idx = change.indexOf("->");
      const fromVal = change.slice(0, idx);
      const toVal = change.slice(idx + 2);
      const type: RoundTripImportResult["learnSignals"][0]["type"] =
        field === "debitAccount" || field === "creditAccount" ? "account_change"
        : field === "vatCode" || field === "vatAmount" ? "vat_change"
        : field === "amount" ? "amount_change" : "description_change";
      signals.push({
        type,
        message: type === "account_change"
          ? "Konto " + fromVal + " wurde " + count + "x in Banana zu " + toVal + " ge\u00e4ndert"
          : type === "vat_change"
            ? "MwSt-Code " + fromVal + " -> " + toVal + " wurde " + count + "x ge\u00e4ndert"
            : field + ": " + fromVal + " -> " + toVal + " (" + count + "x ge\u00e4ndert)",
        frequency: count,
        suggestRuleUpdate: count >= 3,
      });
    }
  }
  return signals.sort((a, b) => b.frequency - a.frequency);
}
