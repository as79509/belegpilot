import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";
import { checkPeriodLock } from "@/lib/services/cockpit/period-guard";
import { trackCorrections } from "@/lib/services/corrections/correction-tracker";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (!hasPermission(ctx.session.user.role, "documents:approve")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Check period lock
    if (document.invoiceDate) {
      const lock = await checkPeriodLock(ctx.companyId, new Date(document.invoiceDate));
      if (lock.locked) {
        return NextResponse.json({ error: lock.message }, { status: 409 });
      }
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

    // Korrekturen tracken: Vergleiche AI-Vorschlag mit finalen Werten
    try {
      const aiResult = await prisma.aiResult.findFirst({
        where: { documentId: id },
        orderBy: { createdAt: "desc" },
        select: { normalizedData: true },
      });
      const aiData = (aiResult?.normalizedData as any) || {};

      await trackCorrections(
        ctx.companyId,
        id,
        ctx.session.user.id,
        {
          accountCode: aiData.accountCode ?? updated.accountCode,
          expenseCategory: aiData.expenseCategory ?? updated.expenseCategory,
          costCenter: aiData.costCenter ?? updated.costCenter,
        },
        {
          accountCode: updated.accountCode,
          expenseCategory: updated.expenseCategory,
          costCenter: updated.costCenter,
        },
        updated.supplierId,
        "review"
      );
    } catch (trackErr) {
      console.error("[Approve] trackCorrections failed", trackErr);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Approve]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
