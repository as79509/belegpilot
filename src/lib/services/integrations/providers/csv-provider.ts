import Papa from "papaparse";
import { prisma } from "@/lib/db";
import type { IntegrationAdapter, IntegrationAction, ImportResult } from "../integration-provider";
import { registerAdapter } from "../provider-registry";

const csvAdapter: IntegrationAdapter = {
  provider: {
    id: "csv",
    name: "CSV / Excel Import",
    description: "Importiert Kontenplan, Buchungen oder Bankbewegungen aus CSV-Dateien",
    supportedActions: ["import_accounts", "import_journal", "import_bank"],
    icon: "FileSpreadsheet",
    canExport: false,
    canImport: true,
    canSync: false,
    requiresApiKey: false,
    configFields: [],
  },

  async executeImport(companyId: string, action: IntegrationAction, data: Buffer | string): Promise<ImportResult> {
    const csvText = (typeof data === "string" ? data : data.toString("utf-8")).replace(/^\uFEFF/, "");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, delimiter: "", dynamicTyping: false });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return { success: false, imported: 0, skipped: 0, errors: parsed.errors.map((e, i) => ({ row: e.row ?? i, message: e.message })), warnings: [] };
    }

    const rows = parsed.data as Record<string, string>[];
    switch (action) {
      case "import_accounts": return importAccounts(companyId, rows);
      case "import_journal": return importJournal(companyId, rows);
      case "import_bank": return importBank(companyId, rows);
      default: return { success: false, imported: 0, skipped: 0, errors: [{ row: 0, message: "Unbekannte Aktion: " + action }], warnings: [] };
    }
  },
};

registerAdapter(csvAdapter);
export { csvAdapter };

// -- Helpers --

function findCol(row: Record<string, string>, ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const key = Object.keys(row).find((k) => k.toLowerCase().trim() === c.toLowerCase());
    if (key && row[key]?.trim()) return row[key].trim();
  }
  return undefined;
}

function parseDate(s: string): Date | null {
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return new Date(Date.UTC(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1])));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3])));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(s: string): number {
  let c = s.replace(/['\s]/g, "");
  if (c.includes(",") && !c.includes(".")) c = c.replace(",", ".");
  if (c.includes(",") && c.includes(".")) c = c.replace(/\./g, "").replace(",", ".");
  return parseFloat(c);
}

// -- import_accounts --

async function importAccounts(companyId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  let imported = 0, skipped = 0;
  const errors: ImportResult["errors"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const accountNumber = findCol(row, "kontonummer", "konto", "account", "number", "nr", "accountnumber");
    const name = findCol(row, "bezeichnung", "name", "description", "kontoname");
    const typeStr = findCol(row, "typ", "type", "accounttype", "kontotyp");

    if (!accountNumber) { errors.push({ row: i + 2, message: "Kontonummer fehlt" }); continue; }
    if (!name) { errors.push({ row: i + 2, message: "Bezeichnung fehlt" }); continue; }

    let accountType = "expense";
    if (typeStr) {
      const t = typeStr.toLowerCase();
      if (t.includes("aktiv") || t === "asset" || t === "1") accountType = "asset";
      else if (t.includes("passiv") || t === "liability" || t === "2") accountType = "liability";
      else if (t.includes("aufwand") || t === "expense" || t === "3") accountType = "expense";
      else if (t.includes("ertrag") || t === "revenue" || t === "4") accountType = "revenue";
      else if (t.includes("eigenkapital") || t === "equity") accountType = "equity";
    } else {
      const num = parseInt(accountNumber);
      if (num >= 1000 && num < 2000) accountType = "asset";
      else if (num >= 2000 && num < 3000) accountType = "liability";
      else if (num >= 3000 && num < 7000) accountType = "expense";
      else if (num >= 7000 && num < 9000) accountType = "revenue";
    }

    const existing = await prisma.account.findUnique({ where: { companyId_accountNumber: { companyId, accountNumber } } });
    if (existing) { skipped++; continue; }

    try {
      await prisma.account.create({ data: { companyId, accountNumber, name, accountType, isActive: true } });
      imported++;
    } catch (err: any) { errors.push({ row: i + 2, message: err.message }); }
  }

  return { success: errors.length === 0, imported, skipped, errors, warnings: [] };
}

// -- import_journal --

async function importJournal(companyId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  let imported = 0, skipped = 0;
  const errors: ImportResult["errors"] = [];

  const accounts = await prisma.account.findMany({ where: { companyId }, select: { accountNumber: true } });
  const validAccounts = new Set(accounts.map((a) => a.accountNumber));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = findCol(row, "datum", "date", "buchungsdatum", "valuta");
    const debit = findCol(row, "soll", "sollkonto", "debit", "soll-konto");
    const credit = findCol(row, "haben", "habenkonto", "credit", "haben-konto");
    const amountStr = findCol(row, "betrag", "amount", "summe");
    const text = findCol(row, "text", "beschreibung", "description", "buchungstext");
    const vatStr = findCol(row, "mwst", "vat", "mwst_betrag", "mwst-betrag");

    if (!dateStr || !debit || !credit || !amountStr) { errors.push({ row: i + 2, message: "Pflichtfelder fehlen (Datum, Soll, Haben, Betrag)" }); continue; }

    const entryDate = parseDate(dateStr);
    if (!entryDate) { errors.push({ row: i + 2, message: "Ung\u00fcltiges Datum: " + dateStr }); continue; }

    const amount = parseAmount(amountStr);
    if (isNaN(amount) || amount <= 0) { errors.push({ row: i + 2, message: "Ung\u00fcltiger Betrag: " + amountStr }); continue; }

    if (!validAccounts.has(debit)) { errors.push({ row: i + 2, message: "Soll-Konto " + debit + " nicht im Kontenplan" }); continue; }
    if (!validAccounts.has(credit)) { errors.push({ row: i + 2, message: "Haben-Konto " + credit + " nicht im Kontenplan" }); continue; }

    const vatAmount = vatStr ? parseAmount(vatStr) : null;

    try {
      await prisma.journalEntry.create({
        data: { companyId, entryDate, debitAccount: debit, creditAccount: credit, amount, vatAmount: vatAmount && !isNaN(vatAmount) ? vatAmount : null, description: text || "CSV Import", entryType: "manual" },
      });
      imported++;
    } catch (err: any) { errors.push({ row: i + 2, message: err.message }); }
  }

  return { success: errors.length === 0, imported, skipped, errors, warnings: [] };
}

// -- import_bank --

async function importBank(companyId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  let imported = 0, skipped = 0;
  const errors: ImportResult["errors"] = [];
  const warnings: string[] = [];

  let bankAccount = await prisma.bankAccount.findFirst({ where: { companyId, isActive: true } });
  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({ data: { companyId, iban: "IMPORT", name: "CSV Import Konto", currency: "CHF" } });
    warnings.push("Kein Bankkonto vorhanden \u2014 Standardkonto erstellt");
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = findCol(row, "datum", "date", "buchungsdatum", "valuta", "booking_date");
    const amountStr = findCol(row, "betrag", "amount", "summe");
    const desc = findCol(row, "beschreibung", "text", "description", "verwendungszweck");
    const ref = findCol(row, "referenz", "reference", "ref", "beleg");
    const iban = findCol(row, "iban", "gegenkonto", "counterparty_iban");

    if (!dateStr || !amountStr) { errors.push({ row: i + 2, message: "Datum und Betrag sind Pflichtfelder" }); continue; }

    const bookingDate = parseDate(dateStr);
    if (!bookingDate) { errors.push({ row: i + 2, message: "Ung\u00fcltiges Datum: " + dateStr }); continue; }

    const amount = parseAmount(amountStr);
    if (isNaN(amount)) { errors.push({ row: i + 2, message: "Ung\u00fcltiger Betrag: " + amountStr }); continue; }

    if (ref) {
      const existing = await prisma.bankTransaction.findFirst({ where: { companyId, bookingDate, amount: Math.abs(amount), bankReference: ref } });
      if (existing) { skipped++; continue; }
    }

    try {
      await prisma.bankTransaction.create({
        data: { companyId, bankAccountId: bankAccount.id, bookingDate, amount: Math.abs(amount), currency: "CHF", isCredit: amount > 0, description: desc || null, bankReference: ref || null, counterpartyIban: iban || null },
      });
      imported++;
    } catch (err: any) { errors.push({ row: i + 2, message: err.message }); }
  }

  return { success: errors.length === 0, imported, skipped, errors, warnings };
}
