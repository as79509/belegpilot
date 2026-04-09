import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/services/audit/audit-service";
import { hasPermission } from "@/lib/permissions";

const FIELD_TO_RULE_ACTION: Record<string, string> = {
  accountCode: "set_account_code",
  expenseCategory: "set_category",
  costCenter: "set_cost_center",
};

const FIELD_LABELS_DE: Record<string, string> = {
  accountCode: "Konto",
  expenseCategory: "Kategorie",
  costCenter: "Kostenstelle",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "corrections:promote")) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Übernehmen von Korrekturmustern" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const promoteTo = body.promoteTo as "rule" | "knowledge" | "supplier_default";

    if (!["rule", "knowledge", "supplier_default"].includes(promoteTo)) {
      return NextResponse.json({ error: "Ungültiges Ziel" }, { status: 400 });
    }

    const pattern = await prisma.correctionPattern.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!pattern) {
      return NextResponse.json({ error: "Muster nicht gefunden" }, { status: 404 });
    }
    if (pattern.status !== "open") {
      return NextResponse.json({ error: "Muster ist nicht offen" }, { status: 409 });
    }

    let promotedEntityId: string | null = null;

    if (promoteTo === "rule") {
      const actionType = FIELD_TO_RULE_ACTION[pattern.field];
      if (!actionType) {
        return NextResponse.json({ error: "Feld nicht als Regel umwandelbar" }, { status: 400 });
      }
      const supplierLabel = pattern.supplierName || "Lieferant";
      const fieldLabel = FIELD_LABELS_DE[pattern.field] || pattern.field;
      const ruleName = `Auto aus Korrekturmuster: ${supplierLabel} → ${fieldLabel} ${pattern.toValue}`;
      const conditions: any[] = [];
      if (pattern.supplierName) {
        conditions.push({ field: "supplierName", operator: "contains", value: pattern.supplierName });
      }
      const rule = await prisma.rule.create({
        data: {
          companyId: ctx.companyId,
          name: ruleName,
          ruleType: "supplier_default",
          conditions,
          actions: [{ type: actionType, value: pattern.toValue }],
          priority: 10,
          isActive: true,
        },
      });
      promotedEntityId = rule.id;
    } else if (promoteTo === "knowledge") {
      const supplierLabel = pattern.supplierName || "(beliebig)";
      const fieldLabel = FIELD_LABELS_DE[pattern.field] || pattern.field;
      const item = await prisma.knowledgeItem.create({
        data: {
          companyId: ctx.companyId,
          category: "correction_pattern",
          title: `Korrekturmuster: ${supplierLabel} – ${fieldLabel}`,
          content:
            `Bei ${supplierLabel} wurde ${pattern.occurrences}× das ${fieldLabel} ` +
            `von "${pattern.fromValue}" auf "${pattern.toValue}" korrigiert. ` +
            `Empfehlung: künftig direkt "${pattern.toValue}" verwenden.`,
          relatedSupplier: pattern.supplierName,
          relatedAccount: pattern.field === "accountCode" ? pattern.toValue : null,
          priority: 5,
          usableByAi: true,
          lastEditedBy: ctx.session.user.id,
        },
      });
      promotedEntityId = item.id;
    } else if (promoteTo === "supplier_default") {
      if (!pattern.supplierId) {
        return NextResponse.json(
          { error: "Lieferantenstandard benötigt einen Lieferanten" },
          { status: 400 }
        );
      }
      const supplierUpdate: any = {};
      if (pattern.field === "accountCode") supplierUpdate.defaultAccountCode = pattern.toValue;
      else if (pattern.field === "expenseCategory") supplierUpdate.defaultCategory = pattern.toValue;
      else if (pattern.field === "costCenter") supplierUpdate.defaultCostCenter = pattern.toValue;
      else {
        return NextResponse.json(
          { error: "Feld nicht als Lieferantenstandard umwandelbar" },
          { status: 400 }
        );
      }
      const supplier = await prisma.supplier.update({
        where: { id: pattern.supplierId },
        data: supplierUpdate,
      });
      promotedEntityId = supplier.id;
    }

    const updated = await prisma.correctionPattern.update({
      where: { id: pattern.id },
      data: {
        status: "promoted",
        promotedTo: promoteTo,
        promotedEntityId,
        promotedAt: new Date(),
      },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "correction_pattern_promoted",
      entityType: "correction_pattern",
      entityId: pattern.id,
      changes: {
        promotedTo: { before: null, after: promoteTo },
        promotedEntityId: { before: null, after: promotedEntityId },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Correction Promote]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
