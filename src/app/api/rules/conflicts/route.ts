import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { detectRuleConflicts } from "@/lib/services/rules/rules-engine";
import { hasPermission } from "@/lib/permissions";

/**
 * Phase 8.9.2 — Liefert eine Konfliktanalyse aller Regeln einer Firma.
 * Wird auf der Rules-Seite als InfoPanel angezeigt.
 */
export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "rules:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const rules = await prisma.rule.findMany({
    where: { companyId: ctx.companyId },
    select: {
      id: true,
      name: true,
      ruleType: true,
      priority: true,
      isActive: true,
      conditions: true,
      actions: true,
    },
  });

  const report = detectRuleConflicts(
    rules.map((r) => ({
      id: r.id,
      name: r.name,
      ruleType: r.ruleType,
      priority: r.priority,
      isActive: r.isActive,
      conditions: r.conditions,
      actions: r.actions,
    }))
  );

  return NextResponse.json(report);
}
