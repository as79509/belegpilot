import { prisma } from "@/lib/db";

export interface MatchCandidate {
  documentId: string;
  documentNumber: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  grossAmount: number | null;
  currency: string | null;
  invoiceDate: string | null;
  paymentReference: string | null;
  confidence: number;
  method: "qr_reference" | "amount_date_iban" | "manual";
}

export async function findMatchCandidates(
  companyId: string,
  tx: {
    amount: number;
    currency: string;
    isCredit: boolean;
    paymentReference?: string | null;
    counterpartyIban?: string | null;
    counterpartyName?: string | null;
    bookingDate: Date;
    remittanceInfo?: string | null;
  }
): Promise<MatchCandidate[]> {
  const candidates: MatchCandidate[] = [];
  const targetAmount = tx.amount;

  // 1. QR-Reference matching (highest confidence)
  if (tx.paymentReference) {
    const refDocs = await prisma.document.findMany({
      where: {
        companyId,
        paymentReference: tx.paymentReference,
        status: { not: "rejected" },
      },
      select: {
        id: true, documentNumber: true, supplierNameNormalized: true,
        supplierNameRaw: true, invoiceNumber: true, grossAmount: true,
        currency: true, invoiceDate: true, paymentReference: true,
      },
    });
    for (const doc of refDocs) {
      candidates.push({
        documentId: doc.id, documentNumber: doc.documentNumber,
        supplierName: doc.supplierNameNormalized || doc.supplierNameRaw,
        invoiceNumber: doc.invoiceNumber,
        grossAmount: doc.grossAmount ? Number(doc.grossAmount) : null,
        currency: doc.currency,
        invoiceDate: doc.invoiceDate?.toISOString() ?? null,
        paymentReference: doc.paymentReference,
        confidence: 0.98, method: "qr_reference",
      });
    }
  }

  // 2. Amount + IBAN matching
  const amountTolerance = 0.01;
  const amountDocs = await prisma.document.findMany({
    where: {
      companyId,
      grossAmount: { gte: targetAmount - amountTolerance, lte: targetAmount + amountTolerance },
      currency: tx.currency,
      status: { not: "rejected" },
    },
    select: {
      id: true, documentNumber: true, supplierNameNormalized: true,
      supplierNameRaw: true, invoiceNumber: true, grossAmount: true,
      currency: true, invoiceDate: true, paymentReference: true, iban: true,
    },
  });

  for (const doc of amountDocs) {
    if (candidates.some((c) => c.documentId === doc.id)) continue;
    let confidence = 0.5;
    if (tx.counterpartyIban && doc.iban && tx.counterpartyIban === doc.iban) confidence += 0.3;
    if (doc.invoiceDate) {
      const daysDiff = Math.abs((tx.bookingDate.getTime() - doc.invoiceDate.getTime()) / 86400000);
      if (daysDiff <= 30) confidence += 0.1;
      if (daysDiff <= 7) confidence += 0.05;
    }
    if (tx.counterpartyName && doc.supplierNameNormalized) {
      const txName = tx.counterpartyName.toLowerCase();
      const docName = doc.supplierNameNormalized.toLowerCase();
      if (txName.includes(docName) || docName.includes(txName)) confidence += 0.1;
    }
    candidates.push({
      documentId: doc.id, documentNumber: doc.documentNumber,
      supplierName: doc.supplierNameNormalized || doc.supplierNameRaw,
      invoiceNumber: doc.invoiceNumber,
      grossAmount: doc.grossAmount ? Number(doc.grossAmount) : null,
      currency: doc.currency,
      invoiceDate: doc.invoiceDate?.toISOString() ?? null,
      paymentReference: doc.paymentReference,
      confidence: Math.min(confidence, 0.95), method: "amount_date_iban",
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 10);
}

export async function autoMatchTransactions(
  companyId: string
): Promise<{ matched: number; unmatched: number }> {
  const unmatchedTxs = await prisma.bankTransaction.findMany({
    where: { companyId, matchStatus: "unmatched" },
  });
  let matchedCount = 0;
  for (const tx of unmatchedTxs) {
    const candidates = await findMatchCandidates(companyId, {
      amount: Number(tx.amount), currency: tx.currency, isCredit: tx.isCredit,
      paymentReference: tx.paymentReference, counterpartyIban: tx.counterpartyIban,
      counterpartyName: tx.counterpartyName, bookingDate: tx.bookingDate,
      remittanceInfo: tx.remittanceInfo,
    });
    const best = candidates[0];
    if (best && best.confidence >= 0.8) {
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          matchStatus: "auto_matched", matchedDocumentId: best.documentId,
          matchConfidence: best.confidence, matchMethod: best.method,
          matchedAt: new Date(),
        },
      });
      matchedCount++;
    }
  }
  return { matched: matchedCount, unmatched: unmatchedTxs.length - matchedCount };
}
