import { XMLParser } from "fast-xml-parser";

// ── Types ──

export interface Camt053Statement {
  iban: string;
  bic?: string;
  bankName?: string;
  statementId: string;
  sequenceNumber?: string;
  fromDate: Date;
  toDate: Date;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  transactions: Camt053Transaction[];
}

export interface Camt053Transaction {
  bookingDate: Date;
  valueDate?: Date;
  amount: number;
  currency: string;
  isCredit: boolean;
  description?: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  endToEndId?: string;
  paymentReference?: string;
  remittanceInfo?: string;
  bankReference?: string;
}

// ── Helper to safely access nested paths ──

function get(obj: any, path: string): any {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

/** Ensure value is always an array (XML parser returns single objects for 1-element lists). */
function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

// ── Parser ──

/**
 * Parse a camt.053 (ISO 20022 BkToCstmrStmt) XML string.
 * Returns one Camt053Statement per <Stmt> element found.
 */
export function parseCamt053(xml: string): Camt053Statement[] {
  if (!xml || typeof xml !== "string") {
    throw new Error("camt.053 Parser: Leere oder ungültige Eingabe");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true, // Strip namespace prefixes (e.g. <ns:BkToCstmrStmt>)
    isArray: (name) => {
      // Elements that can appear multiple times
      return ["Stmt", "Ntry", "TxDtls", "Bal"].includes(name);
    },
  });

  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch (err: any) {
    throw new Error(`camt.053 Parser: Ungültiges XML — ${err.message}`);
  }

  // Navigate to statements: Document > BkToCstmrStmt > Stmt
  const doc = parsed?.Document ?? parsed;
  const bkToCstmrStmt = doc?.BkToCstmrStmt;

  if (!bkToCstmrStmt) {
    throw new Error(
      "camt.053 Parser: Kein BkToCstmrStmt-Element gefunden. Ist dies eine gültige camt.053-Datei?"
    );
  }

  const stmts = toArray(bkToCstmrStmt.Stmt);
  if (stmts.length === 0) {
    throw new Error("camt.053 Parser: Keine Kontoauszüge (Stmt) gefunden");
  }

  return stmts.map(parseStatement);
}

// ── Statement ──

function parseStatement(stmt: any): Camt053Statement {
  // Account info
  const acct = stmt.Acct ?? {};
  const iban = get(acct, "Id.IBAN") ?? "";
  const bic = get(acct, "Svcr.FinInstnId.BICFI") ?? get(acct, "Svcr.FinInstnId.BIC");
  const bankName = get(acct, "Svcr.FinInstnId.Nm");
  const currency = acct.Ccy ?? "CHF";

  // Statement identification
  const statementId = stmt.Id ?? "";
  const sequenceNumber = stmt.ElctrncSeqNb?.toString() ?? stmt.LglSeqNb?.toString();

  // Balances
  const balances = toArray(stmt.Bal);
  const openingBalance = extractBalance(balances, "OPBD", "PRCD");
  const closingBalance = extractBalance(balances, "CLBD", "CLAV");

  // Period — from/to from Frm/To or FrDtTm/ToDtTm
  const frDtTm = get(stmt, "FrToDt.FrDtTm") ?? get(stmt, "FrToDt.FrDt");
  const toDtTm = get(stmt, "FrToDt.ToDtTm") ?? get(stmt, "FrToDt.ToDt");
  const fromDate = frDtTm ? new Date(frDtTm) : new Date();
  const toDate = toDtTm ? new Date(toDtTm) : new Date();

  // Entries
  const entries = toArray(stmt.Ntry);
  const transactions = entries.flatMap(parseEntry);

  return {
    iban,
    bic: bic || undefined,
    bankName: bankName || undefined,
    statementId,
    sequenceNumber: sequenceNumber || undefined,
    fromDate,
    toDate,
    openingBalance,
    closingBalance,
    currency,
    transactions,
  };
}

// ── Balance extraction ──

function extractBalance(balances: any[], ...typeCodes: string[]): number {
  for (const code of typeCodes) {
    const bal = balances.find(
      (b: any) => get(b, "Tp.CdOrPrtry.Cd") === code
    );
    if (bal) {
      const amt = parseFloat(get(bal, "Amt.#text") ?? get(bal, "Amt") ?? "0");
      const cdtDbt = bal.CdtDbtInd;
      return cdtDbt === "DBIT" ? -amt : amt;
    }
  }
  return 0;
}

// ── Entry parsing ──

function parseEntry(ntry: any): Camt053Transaction[] {
  const bookingDateStr = get(ntry, "BookgDt.Dt") ?? get(ntry, "BookgDt.DtTm");
  const valueDateStr = get(ntry, "ValDt.Dt") ?? get(ntry, "ValDt.DtTm");
  const bookingDate = bookingDateStr ? new Date(bookingDateStr) : new Date();
  const valueDate = valueDateStr ? new Date(valueDateStr) : undefined;

  const entryAmount = parseFloat(get(ntry, "Amt.#text") ?? get(ntry, "Amt") ?? "0");
  const entryCurrency = get(ntry, "Amt.@_Ccy") ?? "CHF";
  const isCredit = ntry.CdtDbtInd === "CRDT";

  const bankReference = ntry.AcctSvcrRef ?? undefined;

  // Try to get transaction details
  const ntryDtls = ntry.NtryDtls;
  const txDtlsList = toArray(get(ntryDtls, "TxDtls"));

  // If no TxDtls, return a single transaction from the entry level
  if (txDtlsList.length === 0) {
    return [
      {
        bookingDate,
        valueDate,
        amount: entryAmount,
        currency: entryCurrency,
        isCredit,
        description: extractDescription(ntry),
        bankReference,
      },
    ];
  }

  // Parse each TxDtls as a separate transaction
  return txDtlsList.map((txDtls: any): Camt053Transaction => {
    // Amount: TxDtls may have its own Amt, otherwise use entry amount
    const txAmt = get(txDtls, "Amt.#text") ?? get(txDtls, "Amt");
    const amount = txAmt ? parseFloat(txAmt) : entryAmount;
    const currency = get(txDtls, "Amt.@_Ccy") ?? entryCurrency;

    // References
    const refs = txDtls.Refs ?? {};
    const endToEndId = normalizeRef(refs.EndToEndId);
    const txBankRef = normalizeRef(refs.AcctSvcrRef) ?? bankReference;

    // Payment reference: QR-Ref, ISR/ESR, or structured creditor reference
    const paymentReference = extractPaymentReference(txDtls);

    // Remittance info (unstructured)
    const remittanceInfo = extractRemittanceInfo(txDtls);

    // Counterparty
    const { name: counterpartyName, iban: counterpartyIban } =
      extractCounterparty(txDtls, isCredit);

    // Description: prefer AddtlNtryInf at entry level, then AddtlTxInf at TxDtls level
    const description =
      txDtls.AddtlTxInf ?? get(ntry, "AddtlNtryInf") ?? remittanceInfo ?? undefined;

    return {
      bookingDate,
      valueDate,
      amount,
      currency,
      isCredit,
      description: description || undefined,
      counterpartyName: counterpartyName || undefined,
      counterpartyIban: counterpartyIban || undefined,
      endToEndId: endToEndId || undefined,
      paymentReference: paymentReference || undefined,
      remittanceInfo: remittanceInfo || undefined,
      bankReference: txBankRef || undefined,
    };
  });
}

// ── Payment reference extraction ──

function extractPaymentReference(txDtls: any): string | undefined {
  // 1. Structured: CdtrRefInf > Ref (QR-Reference, ISR/ESR)
  const strd = toArray(get(txDtls, "RmtInf.Strd"));
  for (const s of strd) {
    const ref = get(s, "CdtrRefInf.Ref");
    if (ref) return ref;
  }

  // 2. RfrdDocInf > Nb (document number as reference)
  for (const s of strd) {
    const nb = get(s, "RfrdDocInf.Nb");
    if (nb) return nb;
  }

  return undefined;
}

// ── Remittance info extraction ──

function extractRemittanceInfo(txDtls: any): string | undefined {
  // Unstructured remittance info
  const ustrd = get(txDtls, "RmtInf.Ustrd");
  if (ustrd) {
    return Array.isArray(ustrd) ? ustrd.join(" ") : String(ustrd);
  }

  // Structured additional info
  const strd = toArray(get(txDtls, "RmtInf.Strd"));
  for (const s of strd) {
    const addtl = s.AddtlRmtInf;
    if (addtl) {
      return Array.isArray(addtl) ? addtl.join(" ") : String(addtl);
    }
  }

  return undefined;
}

// ── Counterparty extraction ──

function extractCounterparty(
  txDtls: any,
  isCredit: boolean
): { name?: string; iban?: string } {
  const rltdPties = txDtls.RltdPties ?? {};

  // For credits (incoming): counterparty is Dbtr (debtor)
  // For debits (outgoing): counterparty is Cdtr (creditor)
  const party = isCredit ? rltdPties.Dbtr : rltdPties.Cdtr;
  const partyAcct = isCredit ? rltdPties.DbtrAcct : rltdPties.CdtrAcct;

  const name = party?.Nm ?? get(party, "Pty.Nm");
  const iban = get(partyAcct, "Id.IBAN");

  return { name: name || undefined, iban: iban || undefined };
}

// ── Description fallback ──

function extractDescription(ntry: any): string | undefined {
  return ntry.AddtlNtryInf ?? undefined;
}

// ── Normalize reference (filter NOTPROVIDED etc.) ──

function normalizeRef(ref: any): string | undefined {
  if (!ref || typeof ref !== "string") return undefined;
  const upper = ref.toUpperCase().trim();
  if (upper === "NOTPROVIDED" || upper === "NOTAVAILABLE" || upper === "") return undefined;
  return ref;
}
