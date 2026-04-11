import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const vatCodes = await prisma.vatCodeMapping.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ mappingStatus: "asc" }, { internalRate: "asc" }],
  });

  return NextResponse.json({ vatCodes, total: vatCodes.length });
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "integrations:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { id, internalRate, internalLabel, bananaVatCode, bananaVatLabel, mappingStatus, isDefault, notes } = body;

  if (id) {
    // Update existing
    const existing = await prisma.vatCodeMapping.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "MwSt-Code-Mapping nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.vatCodeMapping.update({
      where: { id },
      data: {
        bananaVatCode: bananaVatCode ?? existing.bananaVatCode,
        bananaVatLabel: bananaVatLabel ?? existing.bananaVatLabel,
        mappingStatus: mappingStatus ?? existing.mappingStatus,
        isDefault: isDefault ?? existing.isDefault,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "vat_code_mapping_updated",
      entityType: "vat_code_mapping",
      entityId: updated.id,
    });

    return NextResponse.json(updated);
  }

  // Create new
  if (internalRate === undefined || internalRate === null) {
    return NextResponse.json({ error: "Interner MwSt-Satz ist erforderlich" }, { status: 400 });
  }
  if (!internalLabel?.trim()) {
    return NextResponse.json({ error: "Interne Bezeichnung ist erforderlich" }, { status: 400 });
  }

  const vatCode = await prisma.vatCodeMapping.create({
    data: {
      companyId: ctx.companyId,
      internalRate: parseFloat(internalRate),
      internalLabel: internalLabel.trim(),
      bananaVatCode: bananaVatCode || null,
      bananaVatLabel: bananaVatLabel || null,
      mappingStatus: mappingStatus || (bananaVatCode ? "mapped" : "unmapped"),
      isDefault: isDefault ?? false,
      notes: notes || null,
    },
  });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "vat_code_mapping_created",
    entityType: "vat_code_mapping",
    entityId: vatCode.id,
  });

  return NextResponse.json(vatCode, { status: 201 });
}
