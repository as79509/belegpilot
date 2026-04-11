import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  const contract = await prisma.contract.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!contract) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(contract);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "contracts:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.contract.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const body = await req.json();
    const fields = ["name", "contractType", "counterparty", "noticePeriod", "autoRenew", "monthlyAmount", "frequency", "debitAccount", "notes", "reminderDays", "status"];
    const data: Record<string, any> = {};
    for (const f of fields) { if (body[f] !== undefined) data[f] = body[f]; }
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;

    const changes = computeChanges(existing as any, data, Object.keys(data));
    const updated = await prisma.contract.update({ where: { id }, data });
    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "contract_updated", entityType: "contract", entityId: id, changes });
    return NextResponse.json(updated);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "contracts:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.contract.update({ where: { id }, data: { status: "terminated" } });
  await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "contract_terminated", entityType: "contract", entityId: id });
  return NextResponse.json({ success: true });
}
