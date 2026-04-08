import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  const entry = await prisma.journalEntry.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const fields = ["entryDate", "debitAccount", "creditAccount", "amount", "vatAmount", "vatRate", "description", "reference", "entryType"];
    const data: Record<string, any> = {};
    for (const f of fields) { if (body[f] !== undefined) data[f] = f === "entryDate" ? new Date(body[f]) : body[f]; }
    const updated = await prisma.journalEntry.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  await prisma.journalEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
