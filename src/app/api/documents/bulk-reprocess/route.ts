import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { dispatchDocumentProcessing } from "@/lib/services/documents/document-processing-dispatch";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "documents:bulk")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { allowed } = rateLimit(`bulk-reprocess:${ctx.session.user.id}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const { documentIds } = await request.json();
    if (!documentIds?.length) {
      return NextResponse.json({ error: "Keine Belege ausgewählt" }, { status: 400 });
    }

    const docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        companyId: ctx.companyId,
        status: { in: ["uploaded", "failed", "needs_review"] },
      },
      select: { id: true },
    });

    let submitted = 0;
    let failed = 0;
    for (const doc of docs) {
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
        source: "bulk_reprocess",
      });
      if (dispatchResult.ok) {
        submitted++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ submitted, failed, total: docs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
