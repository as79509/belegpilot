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
  const existing = await prisma.supplier.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true, isVerified: true },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const result = await prisma.supplier.updateMany({
    where: { id, companyId: ctx.companyId },
    data: { isVerified: true },
  });
  if (result.count === 0) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.supplier.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "supplier_verified",
    entityType: "supplier",
    entityId: id,
    changes: existing.isVerified
      ? undefined
      : {
          isVerified: {
            before: false,
            after: true,
          },
        },
  });

  return NextResponse.json(updated);
}
