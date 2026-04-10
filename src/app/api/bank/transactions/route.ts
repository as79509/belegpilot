import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const matchStatus = searchParams.get("matchStatus");
  const bankAccountId = searchParams.get("bankAccountId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (matchStatus) where.matchStatus = matchStatus;
  if (bankAccountId) where.bankAccountId = bankAccountId;

  const [transactions, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: where as any,
      include: {
        bankAccount: { select: { name: true, iban: true } },
        matchedDoc: {
          select: {
            id: true, documentNumber: true, supplierNameNormalized: true,
            grossAmount: true, currency: true,
          },
        },
      },
      orderBy: { bookingDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bankTransaction.count({ where: where as any }),
  ]);

  return NextResponse.json({
    transactions,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
