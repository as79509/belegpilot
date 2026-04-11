import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { batchId } = await params;

  const entries = await prisma.bananaRoundTripEntry.findMany({
    where: { companyId: ctx.companyId, importBatchId: batchId },
    orderBy: { bananaDate: "asc" },
    include: {
      journalEntry: {
        select: {
          id: true,
          reference: true,
          debitAccount: true,
          creditAccount: true,
          amount: true,
          description: true,
          entryDate: true,
        },
      },
      document: {
        select: { id: true, documentNumber: true, supplierNameNormalized: true },
      },
    },
  });

  if (entries.length === 0) {
    return NextResponse.json({ error: "Batch nicht gefunden" }, { status: 404 });
  }

  const statusCounts: Record<string, number> = {};
  for (const e of entries) {
    statusCounts[e.matchStatus] = (statusCounts[e.matchStatus] || 0) + 1;
  }

  return NextResponse.json({
    importBatchId: batchId,
    importedAt: entries[0].importedAt,
    totalRows: entries.length,
    matched: statusCounts["matched"] || 0,
    modified: statusCounts["modified"] || 0,
    newInBanana: statusCounts["new_in_banana"] || 0,
    unmatched: statusCounts["unmatched"] || 0,
    entries,
  });
}
