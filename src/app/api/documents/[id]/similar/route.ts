import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;

  // Load the current document
  const doc = await prisma.document.findFirst({
    where: { id, companyId: ctx.companyId },
    select: {
      supplierNameNormalized: true,
      grossAmount: true,
      expenseCategory: true,
    },
  });

  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Build OR conditions for similarity
  const orConditions: any[] = [];

  if (doc.supplierNameNormalized) {
    orConditions.push({ supplierNameNormalized: doc.supplierNameNormalized });
  }

  if (doc.grossAmount) {
    const amount = Number(doc.grossAmount);
    const tolerance = amount * 0.2;
    orConditions.push({
      grossAmount: {
        gte: amount - tolerance,
        lte: amount + tolerance,
      },
    });
  }

  if (doc.expenseCategory) {
    orConditions.push({ expenseCategory: doc.expenseCategory });
  }

  if (orConditions.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  const similar = await prisma.document.findMany({
    where: {
      companyId: ctx.companyId,
      id: { not: id },
      OR: orConditions,
    },
    select: {
      id: true,
      documentNumber: true,
      supplierNameNormalized: true,
      supplierNameRaw: true,
      grossAmount: true,
      accountCode: true,
      expenseCategory: true,
      status: true,
      reviewStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    similar: similar.map((d) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      supplierName: d.supplierNameNormalized || d.supplierNameRaw,
      grossAmount: d.grossAmount,
      accountCode: d.accountCode,
      expenseCategory: d.expenseCategory,
      status: d.status,
      reviewStatus: d.reviewStatus,
      createdAt: d.createdAt,
    })),
  });
}
