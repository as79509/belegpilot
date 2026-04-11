import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "suppliers:verify")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const updated = await prisma.supplier.update({
    where: { id },
    data: { isVerified: true },
  });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "supplier_verified",
    entityType: "supplier",
    entityId: id,
  });

  return NextResponse.json(updated);
}
