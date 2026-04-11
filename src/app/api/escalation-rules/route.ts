import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const rules = await prisma.escalationRule.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "escalation:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const body = await request.json();
    const rule = await prisma.escalationRule.create({
      data: {
        companyId: ctx.companyId, name: body.name, condition: body.condition,
        threshold: body.threshold ? parseFloat(body.threshold) : null,
      },
    });
    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "escalation_rule_created", entityType: "escalation_rule", entityId: rule.id });
    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
