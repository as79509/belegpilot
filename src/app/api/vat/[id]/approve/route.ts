import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;

  // Permission check: only admin or trustee
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  });

  if (!user || !["admin", "trustee"].includes(user.role)) {
    return NextResponse.json(
      { error: "Nur Administratoren und Treuhänder können MwSt-Abrechnungen freigeben" },
      { status: 403 }
    );
  }

  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId: ctx.companyId },
  });

  if (!vatReturn) {
    return NextResponse.json({ error: "MwSt-Abrechnung nicht gefunden" }, { status: 404 });
  }

  if (vatReturn.status !== "validated") {
    return NextResponse.json(
      { error: "Nur validierte Abrechnungen können freigegeben werden" },
      { status: 400 }
    );
  }

  const updated = await prisma.vatReturn.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: ctx.session.user.id,
    },
  });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "vat_return_approved",
    entityType: "vat_return",
    entityId: id,
    changes: {
      status: { before: "validated", after: "approved" },
    },
  });

  return NextResponse.json({ vatReturn: updated });
}
