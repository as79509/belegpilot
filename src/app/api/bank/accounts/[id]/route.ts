import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { computeChanges, logAudit } from "@/lib/services/audit/audit-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "bank:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

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

  const changes = computeChanges(existing as any, data, ["name", "iban", "bankName", "currency", "isActive"]);

  const updateResult = await prisma.bankAccount.updateMany({
    where: { id, companyId: ctx.companyId },
    data,
  });
  if (updateResult.count === 0) return NextResponse.json({ error: "Bankkonto nicht gefunden" }, { status: 404 });

  const updated = await prisma.bankAccount.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!updated) return NextResponse.json({ error: "Bankkonto nicht gefunden" }, { status: 404 });

  if (changes) {
    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "bank_account_updated",
      entityType: "bank_account",
      entityId: id,
      changes,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "bank:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.bankAccount.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Bankkonto nicht gefunden" }, { status: 404 });

  const deleted = await prisma.bankAccount.deleteMany({ where: { id, companyId: ctx.companyId } });
  if (deleted.count === 0) return NextResponse.json({ error: "Bankkonto nicht gefunden" }, { status: 404 });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "bank_account_deleted",
    entityType: "bank_account",
    entityId: id,
    changes: {
      deleted: {
        before: existing,
        after: null,
      },
    },
  });

  return NextResponse.json({ success: true });
}
