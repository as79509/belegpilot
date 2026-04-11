import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "corrections:read")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    const pattern = await prisma.correctionPattern.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!pattern) {
      return NextResponse.json({ error: "Muster nicht gefunden" }, { status: 404 });
    }
    if (pattern.status !== "open") {
      return NextResponse.json({ error: "Muster ist nicht offen" }, { status: 409 });
    }

    const updated = await prisma.correctionPattern.update({
      where: { id: pattern.id },
      data: {
        status: "dismissed",
        dismissedAt: new Date(),
        dismissedReason: reason || null,
      },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "correction_pattern_dismissed",
      entityType: "correction_pattern",
      entityId: pattern.id,
      changes: reason ? { reason: { before: null, after: reason } } : undefined,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Correction Dismiss]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
