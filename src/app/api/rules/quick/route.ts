import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "rules:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { supplierName, actionType, value } = await request.json();

    if (!supplierName?.trim()) return NextResponse.json({ error: "Lieferantenname erforderlich" }, { status: 400 });
    if (!actionType) return NextResponse.json({ error: "Aktion erforderlich" }, { status: 400 });

    const actionLabels: Record<string, string> = {
      set_category: value || "",
      set_account_code: `Konto ${value || ""}`,
      set_cost_center: `KST ${value || ""}`,
      auto_approve: "Auto-Genehmigung",
    };

    const ruleName = `Auto: ${supplierName} → ${actionLabels[actionType] || value || actionType}`;
    const ruleType = actionType === "auto_approve" ? "auto_approve" : "supplier_default";

    const rule = await prisma.rule.create({
      data: {
        companyId: ctx.companyId,
        name: ruleName,
        ruleType,
        conditions: [{ field: "supplierName", operator: "contains", value: supplierName }],
        actions: [{ type: actionType, ...(value ? { value } : {}) }],
        priority: 10,
        isActive: true,
      },
    });

    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "rule_created", entityType: "rule", entityId: rule.id });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
