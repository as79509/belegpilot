import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.knowledgeItem.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const body = await req.json();
    const fields = ["title", "content", "category", "relatedSupplier", "relatedAccount", "isActive", "usableByAi", "priority", "documentType", "isGlobal"];
    const data: Record<string, any> = {};
    for (const f of fields) { if (body[f] !== undefined) data[f] = body[f]; }
    if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    data.lastEditedBy = ctx.session.user.id;
    data.version = (existing.version || 1) + 1;

    const changes = computeChanges(existing as any, data, Object.keys(data));
    const updated = await prisma.knowledgeItem.update({ where: { id }, data });
    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "knowledge_updated", entityType: "knowledge_item", entityId: id, changes });
    return NextResponse.json(updated);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  await prisma.knowledgeItem.delete({ where: { id } });
  await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "knowledge_deleted", entityType: "knowledge_item", entityId: id });
  return NextResponse.json({ success: true });
}
