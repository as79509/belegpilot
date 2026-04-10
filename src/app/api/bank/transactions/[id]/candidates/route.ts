import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { findMatchCandidates } from "@/lib/services/bank/matching-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";

  const tx = await prisma.bankTransaction.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!tx) return NextResponse.json({ error: "Transaktion nicht gefunden" }, { status: 404 });

  // Get auto-match candidates
  const candidates = await findMatchCandidates(ctx.companyId, {
    amount: Number(tx.amount),
    currency: tx.currency,
    isCredit: tx.isCredit,
    paymentReference: tx.paymentReference,
    counterpartyIban: tx.counterpartyIban,
    counterpartyName: tx.counterpartyName,
    bookingDate: tx.bookingDate,
    remittanceInfo: tx.remittanceInfo,
  });

  // If search term provided, also search by document number / supplier name
  let searchResults: any[] = [];
  if (search.trim()) {
    const searchDocs = await prisma.document.findMany({
      where: {
        companyId: ctx.companyId,
        status: { not: "rejected" },
        OR: [
          { documentNumber: { contains: search, mode: "insensitive" } },
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { supplierNameNormalized: { contains: search, mode: "insensitive" } },
          { supplierNameRaw: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        documentNumber: true,
        supplierNameNormalized: true,
        supplierNameRaw: true,
        invoiceNumber: true,
        grossAmount: true,
        currency: true,
        invoiceDate: true,
        paymentReference: true,
      },
      take: 10,
    });

    searchResults = searchDocs
      .filter((d) => !candidates.some((c) => c.documentId === d.id))
      .map((doc) => ({
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        supplierName: doc.supplierNameNormalized || doc.supplierNameRaw,
        invoiceNumber: doc.invoiceNumber,
        grossAmount: doc.grossAmount ? Number(doc.grossAmount) : null,
        currency: doc.currency,
        invoiceDate: doc.invoiceDate?.toISOString() ?? null,
        paymentReference: doc.paymentReference,
        confidence: 0,
        method: "manual" as const,
      }));
  }

  return NextResponse.json({ candidates, searchResults });
}
