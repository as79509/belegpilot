import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit } from "@/lib/services/audit/audit-service";

const DEFAULT_ESCALATIONS = [
  { name: "Neuer Lieferant", condition: "new_supplier", threshold: null },
  { name: "Betrag über CHF 5'000", condition: "amount_above", threshold: 5000 },
  { name: "Auslandsbeleg", condition: "foreign_document", threshold: null },
  { name: "Rechnungsnummer fehlt", condition: "missing_invoice_number", threshold: null },
  { name: "Gemischte MwSt", condition: "mixed_vat", threshold: null },
];

export async function POST() {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "trustee"].includes(ctx.session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const existing = await prisma.escalationRule.findMany({
      where: { companyId: ctx.companyId },
      select: { condition: true },
    });
    const existingConditions = new Set(existing.map((r) => r.condition));

    let created = 0;
    let existingCount = 0;

    for (const def of DEFAULT_ESCALATIONS) {
      if (existingConditions.has(def.condition)) {
        existingCount++;
        continue;
      }

      const rule = await prisma.escalationRule.create({
        data: {
          companyId: ctx.companyId,
          name: def.name,
          condition: def.condition,
          threshold: def.threshold,
        },
      });

      await logAudit({
        companyId: ctx.companyId,
        userId: ctx.session.user.id,
        action: "escalation_rule_created",
        entityType: "escalation_rule",
        entityId: rule.id,
      });

      created++;
    }

    return NextResponse.json({ created, existing: existingCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
