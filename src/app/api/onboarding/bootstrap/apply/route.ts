import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { applyBootstrappedItems } from "@/lib/services/onboarding/bootstrap-apply";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:execute")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { itemIds } = body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: "itemIds erforderlich" }, { status: 400 });
  }

  const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
  if (!session) return NextResponse.json({ error: "Keine Onboarding-Session gefunden" }, { status: 404 });

  const result = await applyBootstrappedItems(ctx.companyId, session.id, itemIds);

  await logAudit({
    companyId: ctx.companyId, userId: ctx.session.user.id,
    action: "onboarding_bootstrap_applied", entityType: "onboarding_session", entityId: session.id,
    changes: {
      rules: { before: null, after: result.rulesCreated },
      knowledge: { before: null, after: result.knowledgeCreated },
      expectedDocs: { before: null, after: result.expectedDocsCreated },
      supplierDefaults: { before: null, after: result.supplierDefaultsApplied },
    },
  });

  return NextResponse.json(result);
}
