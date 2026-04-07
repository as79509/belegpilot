import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (!["admin", "reviewer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const document = await prisma.document.findFirst({
      where: { id, companyId: session.user.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: "ready",
        reviewStatus: "approved",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "document_approved",
      entityType: "document",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Approve]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
