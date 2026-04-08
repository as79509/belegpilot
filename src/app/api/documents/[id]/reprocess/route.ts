import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { DbNull } from "@/generated/prisma/internal/prismaNamespace";
import { inngest } from "@/lib/inngest/client";
import { logAudit } from "@/lib/services/audit/audit-service";
import { rateLimit } from "@/lib/rate-limit";

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

    const { allowed } = rateLimit(`reprocess:${ctx.session.user.id}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    if (!["uploaded", "failed", "needs_review", "rejected"].includes(document.status)) {
      return NextResponse.json(
        { error: "Dokument kann in diesem Status nicht erneut verarbeitet werden" },
        { status: 400 }
      );
    }

    await prisma.document.update({
      where: { id },
      data: {
        status: "uploaded",
        validationResults: DbNull,
        processingDecision: null as any,
      },
    });

    console.log("[Reprocess] Sending inngest event for:", id);
    try {
      await inngest.send({
        name: "document/uploaded",
        data: { documentId: id },
      });
      console.log("[Reprocess] Inngest event sent");
    } catch (inngestErr) {
      console.error("[Reprocess] Inngest send failed:", inngestErr);
    }

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "document_reprocessed",
      entityType: "document",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Reprocess]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
