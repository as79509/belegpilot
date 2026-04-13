import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { dispatchDocumentProcessing } from "@/lib/services/documents/document-processing-dispatch";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { allowed } = rateLimit(`reset-stuck:${ctx.session.user.id}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find documents stuck at 'processing' for more than 30 minutes
    const stuck = await prisma.document.findMany({
      where: {
        companyId: ctx.companyId,
        status: "processing",
        updatedAt: { lt: thirtyMinAgo },
      },
      select: { id: true },
    });

    let submitted = 0;
    let failed = 0;
    for (const doc of stuck) {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: "uploaded",
          processingDecision: null,
        },
      });
      const dispatchResult = await dispatchDocumentProcessing({
        companyId: ctx.companyId,
        documentId: doc.id,
        source: "reset_stuck",
      });
      if (dispatchResult.ok) {
        submitted++;
      } else {
        failed++;
      }
    }

    console.log(`[Reset-Stuck] Reset ${stuck.length} documents, submitted ${submitted} for reprocessing, failed ${failed}`);

    return NextResponse.json({ found: stuck.length, submitted, failed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
