import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (!["admin", "reviewer"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: "ready",
        reviewStatus: "approved",
        reviewedBy: ctx.session.user.id,
        reviewedAt: new Date(),
      },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "document_approved",
      entityType: "document",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Approve]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
