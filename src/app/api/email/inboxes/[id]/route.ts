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
  const existing = await prisma.emailInbox.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Eingang nicht gefunden" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, any> = {};
  if (body.label !== undefined) data.label = body.label || null;
  if (body.autoProcess !== undefined) data.autoProcess = body.autoProcess;
  if (body.allowedSenders !== undefined) data.allowedSenders = body.allowedSenders;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.emailInbox.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.emailInbox.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Eingang nicht gefunden" }, { status: 404 });

  await prisma.emailInbox.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
