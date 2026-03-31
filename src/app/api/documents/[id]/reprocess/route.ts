import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DbNull } from "@/generated/prisma/internal/prismaNamespace";
import { inngest } from "@/lib/inngest/client";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, companyId: session.user.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      companyId: session.user.companyId,
      userId: session.user.id,
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
