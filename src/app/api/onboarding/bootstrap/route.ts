import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { runBootstrapping } from "@/lib/services/onboarding/bootstrapping-engine";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const profile = await prisma.businessProfile.findUnique({ where: { companyId: ctx.companyId } });
  if (!profile) return NextResponse.json({ items: [], summary: { total: 0, byType: {}, byGovernance: {}, readinessImpact: {} }, newKnownUnknowns: [] });

  const items: any[] = [];
  for (const r of (profile.suggestedRules as any[] || [])) items.push({ ...r, type: "rule" });
  for (const k of (profile.suggestedKnowledge as any[] || [])) items.push({ ...k, type: "knowledge" });
  for (const e of (profile.suggestedExpectedDocs as any[] || [])) items.push({ ...e, type: "expected_doc" });
  for (const s of (profile.suggestedSupplierDefaults as any[] || [])) items.push({ ...s, type: "supplier_default" });

  return NextResponse.json({ items, summary: { total: items.length, byType: {}, byGovernance: {}, readinessImpact: {} }, newKnownUnknowns: [] });
}

export async function POST() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:execute")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
  if (!session) return NextResponse.json({ error: "Keine Onboarding-Session gefunden" }, { status: 404 });

  const result = await runBootstrapping(ctx.companyId, session.id);

  // Persist KnownUnknowns
  for (const unk of result.newKnownUnknowns) {
    const existing = await prisma.onboardingKnownUnknown.findFirst({
      where: { sessionId: session.id, area: unk.area, description: unk.description },
    });
    if (!existing) {
      await prisma.onboardingKnownUnknown.create({
        data: { sessionId: session.id, companyId: ctx.companyId, area: unk.area, description: unk.description, criticality: unk.criticality, suggestedAction: unk.suggestedAction },
      });
    }
  }

  // Save summary to stepData
  const stepData = (session.stepData as Record<string, any>) || {};
  stepData["5"] = { bootstrapSummary: result.summary, ranAt: new Date().toISOString() };
  await prisma.onboardingSession.update({ where: { id: session.id }, data: { stepData } });

  await logAudit({
    companyId: ctx.companyId, userId: ctx.session.user.id,
    action: "onboarding_bootstrap_run", entityType: "onboarding_session", entityId: session.id,
    changes: { total: { before: null, after: result.summary.total } },
  });

  return NextResponse.json(result);
}
