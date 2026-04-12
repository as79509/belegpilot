import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "autopilot:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const override = await prisma.supplierAutopilotOverride.findUnique({
    where: { companyId_supplierId: { companyId: ctx.companyId, supplierId: id } },
  });

  return NextResponse.json({ override: override || null });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "autopilot:configure")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { mode, reason } = body;

  if (!mode || !["shadow", "prefill", "auto_ready", "disabled"].includes(mode)) {
    return NextResponse.json({ error: "Ung\u00fcltiger Modus" }, { status: 400 });
  }

  const override = await prisma.supplierAutopilotOverride.upsert({
    where: { companyId_supplierId: { companyId: ctx.companyId, supplierId: id } },
    update: { mode, reason: reason || null, setBy: ctx.session.user.id },
    create: {
      companyId: ctx.companyId,
      supplierId: id,
      mode,
      reason: reason || null,
      setBy: ctx.session.user.id,
    },
  });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "supplier_autopilot_override_set",
    entityType: "supplier",
    entityId: id,
    changes: { mode: { before: null, after: mode } },
  });

  return NextResponse.json({ override });
}
