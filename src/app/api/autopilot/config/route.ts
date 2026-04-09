import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

const DEFAULT_CONFIG = {
  enabled: false,
  mode: "shadow",
  minHistoryMatches: 5,
  minStabilityScore: 0.8,
  maxAmount: null as number | null,
  minConfidence: 0.85,
  allowedDocTypes: null as string[] | null,
  allowedCurrencies: null as string[] | null,
  supplierAllowlist: null as string[] | null,
  killSwitchActive: false,
  killSwitchBy: null,
  killSwitchAt: null,
  killSwitchReason: null,
};

const ALLOWED_MODES = ["shadow", "prefill", "auto_ready"] as const;

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const config = await prisma.autopilotConfig.findUnique({
    where: { companyId: ctx.companyId },
  });

  if (!config) {
    return NextResponse.json({ ...DEFAULT_CONFIG, companyId: ctx.companyId, exists: false });
  }

  return NextResponse.json({ ...config, exists: true });
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "trustee"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();

    if (body.mode !== undefined && !ALLOWED_MODES.includes(body.mode)) {
      return NextResponse.json({ error: "Ungültiger Modus" }, { status: 400 });
    }
    if (body.minConfidence !== undefined && (body.minConfidence < 0 || body.minConfidence > 1)) {
      return NextResponse.json({ error: "Confidence muss zwischen 0 und 1 liegen" }, { status: 400 });
    }
    if (
      body.minStabilityScore !== undefined &&
      (body.minStabilityScore < 0 || body.minStabilityScore > 1)
    ) {
      return NextResponse.json(
        { error: "Stabilität muss zwischen 0 und 1 liegen" },
        { status: 400 }
      );
    }

    const existing = await prisma.autopilotConfig.findUnique({
      where: { companyId: ctx.companyId },
    });

    const updateData: any = {
      updatedBy: ctx.session.user.id,
    };
    const trackedFields = [
      "enabled",
      "mode",
      "minHistoryMatches",
      "minStabilityScore",
      "maxAmount",
      "minConfidence",
      "allowedDocTypes",
      "allowedCurrencies",
      "supplierAllowlist",
    ];
    for (const field of trackedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

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

    const changes = existing
      ? computeChanges(existing as any, saved as any, trackedFields)
      : { created: { before: null, after: true } };

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "autopilot_config_updated",
      entityType: "autopilot_config",
      entityId: saved.id,
      changes,
    });

    return NextResponse.json(saved);
  } catch (error: any) {
    console.error("[Autopilot Config PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
