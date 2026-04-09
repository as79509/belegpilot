import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "reviewer"].includes(ctx.session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const { allowed } = rateLimit(`bulk-reject:${ctx.session.user.id}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const { documentIds, reason } = await request.json();
    if (!documentIds?.length) {
      return NextResponse.json({ error: "Keine Belege ausgewählt" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ error: "Ablehnungsgrund ist erforderlich" }, { status: 400 });
    }

    const docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        companyId: ctx.companyId,
        status: { notIn: ["rejected", "exported"] },
      },
      select: { id: true },
    });

    let rejected = 0;
    for (const doc of docs) {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: "rejected",
          reviewStatus: "rejected",
          reviewNotes: reason,
          reviewedBy: ctx.session.user.id,
          reviewedAt: new Date(),
        },
      });

      await logAudit({
        companyId: ctx.companyId,
        userId: ctx.session.user.id,
        action: "document_bulk_rejected",
        entityType: "document",
        entityId: doc.id,
        changes: { reason: { before: null, after: reason } },
      });

      rejected++;
    }

    const skipped = documentIds.length - rejected;
    return NextResponse.json({ rejected, skipped });
  } catch (error: any) {
    console.error("[BulkReject]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
