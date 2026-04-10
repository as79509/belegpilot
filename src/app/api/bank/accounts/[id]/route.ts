import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.bankAccount.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Bankkonto nicht gefunden" }, { status: 404 });

  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.iban !== undefined) data.iban = body.iban.replace(/\s/g, "");
  if (body.bankName !== undefined) data.bankName = body.bankName || null;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.bankAccount.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.bankAccount.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Bankkonto nicht gefunden" }, { status: 404 });

  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
