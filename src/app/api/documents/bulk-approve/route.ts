import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";
import { rateLimit } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "documents:bulk")) {
      return NextResponse.json(
        { error: "Keine Berechtigung für Massen-Freigabe" },
        { status: 403 }
      );
    }

    const { allowed } = rateLimit(`bulk-approve:${ctx.session.user.id}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const { documentIds } = await request.json();
    if (!documentIds?.length) {
      return NextResponse.json({ error: "Keine Belege ausgewählt" }, { status: 400 });
    }

    // Only approve documents that are in needs_review or ready status
    const docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        companyId: ctx.companyId,
        status: { in: ["needs_review", "ready"] },
      },
      select: { id: true, status: true },
    });

    const approvableIds = docs.map((d) => d.id);
    const skipped = documentIds.length - approvableIds.length;

    // Bulk update all approvable documents
    let approved = 0;
    for (const doc of docs) {
      await prisma.document.updateMany({
        where: { id: doc.id, companyId: ctx.companyId },
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
        action: "document_bulk_approved",
        entityType: "document",
        entityId: doc.id,
      });

      approved++;
    }

    return NextResponse.json({ approved, skipped });
  } catch (error: any) {
    console.error("[BulkApprove]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
