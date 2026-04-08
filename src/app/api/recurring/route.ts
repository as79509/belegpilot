import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const entries = await prisma.recurringEntry.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const body = await request.json();
    const entry = await prisma.recurringEntry.create({
      data: {
        companyId: ctx.companyId,
        name: body.name,
        debitAccount: body.debitAccount,
        creditAccount: body.creditAccount,
        amount: body.amount,
        currency: body.currency || "CHF",
        vatAmount: body.vatAmount || null,
        description: body.description,
        frequency: body.frequency,
        dayOfMonth: body.dayOfMonth || 1,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
