import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "expected-docs:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.expectedDocument.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const fields = ["name", "counterparty", "frequency", "debitAccount", "linkedContractId", "isActive"];
    const data: Record<string, any> = {};
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.expectedAmount !== undefined) data.expectedAmount = body.expectedAmount != null ? Number(body.expectedAmount) : null;
    if (body.tolerancePercent !== undefined) data.tolerancePercent = body.tolerancePercent != null ? Number(body.tolerancePercent) : 20;

    const updated = await prisma.expectedDocument.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "expected-docs:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.expectedDocument.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    await prisma.expectedDocument.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
