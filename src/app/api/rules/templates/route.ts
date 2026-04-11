import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";
import { RULE_TEMPLATES } from "@/lib/services/rules/rule-templates";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const existingRules = await prisma.rule.findMany({
    where: { companyId: ctx.companyId },
    select: { name: true },
  });
  const existingNames = new Set(existingRules.map((r) => r.name));

  const templates = RULE_TEMPLATES.map((t) => ({
    ...t,
    alreadyActive: existingNames.has(t.name),
  }));

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "rules:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { templateId } = await request.json();
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });

    const rule = await prisma.rule.create({
      data: {
        companyId: ctx.companyId,
        name: template.name,
        ruleType: template.ruleType as any,
        conditions: template.conditions,
        actions: template.actions,
        priority: 5,
        isActive: true,
        isGlobal: template.isGlobal,
      },
    });

    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "rule_created", entityType: "rule", entityId: rule.id });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
