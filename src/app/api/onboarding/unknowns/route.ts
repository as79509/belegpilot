import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
  if (!session) return NextResponse.json({ unknowns: [], summary: { total: 0, open: 0, resolved: 0, blockers: 0 } });

  const unknowns = await prisma.onboardingKnownUnknown.findMany({
    where: { sessionId: session.id },
    orderBy: [{ status: "asc" }, { criticality: "desc" }, { createdAt: "desc" }],
  });

  const open = unknowns.filter((u) => u.status === "open").length;
  const resolved = unknowns.filter((u) => u.status === "resolved" || u.status === "accepted").length;
  const blockers = unknowns.filter((u) => u.status === "open" && u.blocksGoLive).length;

  return NextResponse.json({
    unknowns: unknowns.map((u) => ({
      id: u.id,
      area: u.area,
      description: u.description,
      criticality: u.criticality,
      blocksGoLive: u.blocksGoLive,
      reducesReadiness: u.reducesReadiness,
      suggestedAction: u.suggestedAction,
      responsibleRole: u.responsibleRole,
      status: u.status,
      resolution: u.resolution,
    })),
    summary: { total: unknowns.length, open, resolved, blockers },
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:execute")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { id, action, resolution } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "ID und Aktion erforderlich" }, { status: 400 });
  }

  const unknown = await prisma.onboardingKnownUnknown.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!unknown) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updateData: any = {};
  if (action === "resolve") {
    updateData.status = "resolved";
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = ctx.session.user.id;
    updateData.resolution = resolution || null;
  } else if (action === "accept") {
    updateData.status = "accepted";
  } else if (action === "defer") {
    updateData.status = "deferred";
  } else {
    return NextResponse.json({ error: "Ung\u00fcltige Aktion" }, { status: 400 });
  }

  const updated = await prisma.onboardingKnownUnknown.update({ where: { id }, data: updateData });
  return NextResponse.json({ unknown: updated });
}
