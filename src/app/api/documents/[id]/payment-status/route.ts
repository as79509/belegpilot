import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true, grossAmount: true, currency: true },
  });
  if (!doc) return NextResponse.json({ error: "Beleg nicht gefunden" }, { status: 404 });

  const transactions = await prisma.bankTransaction.findMany({
    where: { matchedDocumentId: id, companyId: ctx.companyId },
    include: {
      bankAccount: { select: { name: true } },
    },
    orderBy: { bookingDate: "desc" },
  });

  const totalDue = doc.grossAmount ? Number(doc.grossAmount) : 0;
  const totalPaid = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Check for no_match flag
  const hasNoMatch = transactions.some((tx) => tx.matchStatus === "no_match");

  let status: "open" | "paid" | "partial" | "unclear";
  if (hasNoMatch && transactions.length === 0) {
    status = "unclear";
  } else if (transactions.length === 0) {
    status = "open";
  } else if (totalDue > 0 && Math.abs(totalPaid - totalDue) <= 0.01) {
    status = "paid";
  } else if (totalPaid > 0 && totalPaid < totalDue) {
    status = "partial";
  } else if (totalPaid >= totalDue) {
    status = "paid";
  } else {
    status = "open";
  }

  return NextResponse.json({
    status,
    totalPaid,
    totalDue,
    transactions: transactions.map((tx) => ({
      id: tx.id,
      bookingDate: tx.bookingDate.toISOString(),
      amount: Number(tx.amount),
      counterpartyName: tx.counterpartyName,
      matchMethod: tx.matchMethod,
      bankAccountName: tx.bankAccount.name,
    })),
  });
}
