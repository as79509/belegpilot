import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!["admin", "reviewer"].includes(session.user.role))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const updated = await prisma.supplier.update({
    where: { id },
    data: { isVerified: true },
  });

  await logAudit({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "supplier_verified",
    entityType: "supplier",
    entityId: id,
  });

  return NextResponse.json(updated);
}
