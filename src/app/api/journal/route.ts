import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const entryType = searchParams.get("entryType");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (entryType) where.entryType = entryType;
  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom) where.entryDate.gte = new Date(dateFrom);
    if (dateTo) where.entryDate.lte = new Date(dateTo + "T23:59:59Z");
  }

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where: where as any,
      include: { user: { select: { name: true } } },
      orderBy: { entryDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.journalEntry.count({ where: where as any }),
  ]);

  return NextResponse.json({ entries, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await request.json();
    const entry = await prisma.journalEntry.create({
      data: {
        companyId: ctx.companyId,
        entryDate: new Date(body.entryDate),
        debitAccount: body.debitAccount,
        creditAccount: body.creditAccount,
        amount: body.amount,
        currency: body.currency || "CHF",
        vatAmount: body.vatAmount || null,
        vatRate: body.vatRate || null,
        description: body.description,
        reference: body.reference || null,
        documentId: body.documentId || null,
        entryType: body.entryType || "manual",
        createdBy: ctx.session.user.id,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
