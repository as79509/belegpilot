import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, any> = {};
    for (const f of ["name", "condition", "threshold", "isActive"]) { if (body[f] !== undefined) data[f] = body[f]; }
    const updated = await prisma.escalationRule.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  await prisma.escalationRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
