import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "trustee"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const active = body?.active;
    const reason: string | undefined = body?.reason;

    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active muss boolean sein" }, { status: 400 });
    }
    if (active && !reason?.trim()) {
      return NextResponse.json(
        { error: "Grund ist beim Aktivieren erforderlich" },
        { status: 400 }
      );
    }

    const existing = await prisma.autopilotConfig.findUnique({
      where: { companyId: ctx.companyId },
    });

    const updateData = active
      ? {
          killSwitchActive: true,
          killSwitchBy: ctx.session.user.id,
          killSwitchAt: new Date(),
          killSwitchReason: reason || null,
          updatedBy: ctx.session.user.id,
        }
      : {
          killSwitchActive: false,
          killSwitchBy: null,
          killSwitchAt: null,
          killSwitchReason: null,
          updatedBy: ctx.session.user.id,
        };

    let saved;
    if (existing) {
      saved = await prisma.autopilotConfig.update({
        where: { companyId: ctx.companyId },
        data: updateData,
      });
    } else {
      saved = await prisma.autopilotConfig.create({
        data: {
          companyId: ctx.companyId,
          ...updateData,
        },
      });
    }

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: active ? "autopilot_kill_switch_activated" : "autopilot_kill_switch_deactivated",
      entityType: "autopilot_config",
      entityId: saved.id,
      changes: active
        ? { reason: { before: null, after: reason || null } }
        : undefined,
    });

    return NextResponse.json(saved);
  } catch (error: any) {
    console.error("[Autopilot Kill Switch]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
