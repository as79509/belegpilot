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

  if (!hasPermission(ctx.session.user.role, "email:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

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

  const result = await prisma.emailInbox.updateMany({
    where: { id, companyId: ctx.companyId },
    data,
  });
  if (result.count === 0) return NextResponse.json({ error: "Eingang nicht gefunden" }, { status: 404 });

  const updated = await prisma.emailInbox.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!updated) return NextResponse.json({ error: "Eingang nicht gefunden" }, { status: 404 });

  const changes = computeChanges(existing as any, updated as any, [
    "label",
    "autoProcess",
    "allowedSenders",
    "isActive",
  ]);

  if (changes) {
    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "email_inbox_updated",
      entityType: "email_inbox",
      entityId: updated.id,
      changes,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "email:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.emailInbox.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Eingang nicht gefunden" }, { status: 404 });

  const result = await prisma.emailInbox.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (result.count === 0) return NextResponse.json({ error: "Eingang nicht gefunden" }, { status: 404 });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "email_inbox_deleted",
    entityType: "email_inbox",
    entityId: existing.id,
    changes: {
      deleted: {
        before: {
          inboxAddress: existing.inboxAddress,
          label: existing.label,
          autoProcess: existing.autoProcess,
          allowedSenders: existing.allowedSenders,
          isActive: existing.isActive,
        },
        after: null,
      },
    },
  });

  return NextResponse.json({ success: true });
}
