import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "suppliers:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { primaryId, secondaryId } = await request.json();
    if (!primaryId || !secondaryId)
      return NextResponse.json({ error: "Primärer und sekundärer Lieferant erforderlich" }, { status: 400 });

    const [primary, secondary] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: primaryId, companyId: ctx.companyId } }),
      prisma.supplier.findFirst({ where: { id: secondaryId, companyId: ctx.companyId } }),
    ]);

    if (!primary || !secondary)
      return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });

    // Move all documents from secondary to primary
    const movedDocs = await prisma.document.updateMany({
      where: { supplierId: secondaryId },
      data: { supplierId: primaryId },
    });

    // Merge name variants
    const primaryVariants = (primary.nameVariants as string[]) || [];
    const secondaryVariants = (secondary.nameVariants as string[]) || [];
    const mergedVariants = [
      ...new Set([...primaryVariants, ...secondaryVariants, secondary.nameNormalized]),
    ];

    // Update primary supplier
    await prisma.supplier.update({
      where: { id: primaryId },
      data: {
        nameVariants: mergedVariants,
        documentCount: primary.documentCount + secondary.documentCount,
        vatNumber: primary.vatNumber || secondary.vatNumber,
        iban: primary.iban || secondary.iban,
      },
    });

    // Deactivate secondary
    await prisma.supplier.update({
      where: { id: secondaryId },
      data: { isActive: false },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "supplier_merged",
      entityType: "supplier",
      entityId: primaryId,
      changes: {
        merged: { before: secondaryId, after: primaryId },
        movedDocuments: { before: 0, after: movedDocs.count },
      },
    });

    return NextResponse.json({ success: true, movedDocuments: movedDocs.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
