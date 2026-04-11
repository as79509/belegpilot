import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "escalation:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.escalationRule.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};
    for (const f of ["name", "condition", "threshold", "isActive"]) { if (body[f] !== undefined) data[f] = body[f]; }
    const changes = computeChanges(existing as any, data, Object.keys(data));
    const updated = await prisma.escalationRule.update({ where: { id }, data });
    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "escalation_rule_updated", entityType: "escalation_rule", entityId: id, changes });
    return NextResponse.json(updated);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "escalation:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.escalationRule.delete({ where: { id } });
  await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "escalation_rule_deleted", entityType: "escalation_rule", entityId: id });
  return NextResponse.json({ success: true });
}
