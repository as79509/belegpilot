import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const rule = await prisma.rule.findFirst({
    where: { id, companyId: session.user.companyId },
  });
  if (!rule) return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (session.user.role !== "admin")
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const { id } = await params;
    const rule = await prisma.rule.findFirst({
      where: { id, companyId: session.user.companyId },
    });
    if (!rule) return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 });

    const body = await request.json();
    const updateData: Record<string, any> = {};
    for (const f of ["name", "conditions", "actions", "priority", "isActive"]) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const updated = await prisma.rule.update({ where: { id }, data: updateData });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (session.user.role !== "admin")
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const rule = await prisma.rule.findFirst({
    where: { id, companyId: session.user.companyId },
  });
  if (!rule) return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 });

  await prisma.rule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
