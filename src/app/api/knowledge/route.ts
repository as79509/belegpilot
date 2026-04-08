import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const items = await prisma.knowledgeItem.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "trustee"].includes(ctx.session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    const body = await request.json();
    const item = await prisma.knowledgeItem.create({
      data: {
        companyId: ctx.companyId, category: body.category, title: body.title,
        content: body.content, relatedSupplier: body.relatedSupplier || null,
        relatedAccount: body.relatedAccount || null, usableByAi: body.usableByAi ?? true,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        documentType: body.documentType || null,
        isGlobal: body.isGlobal ?? false,
        lastEditedBy: ctx.session.user.id,
      },
    });
    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "knowledge_created", entityType: "knowledge_item", entityId: item.id });
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
