import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (ctx.session.user.role !== "admin")
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

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

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
