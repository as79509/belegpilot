import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { analyzeNewClient } from "@/lib/services/onboarding/onboarding-analyzer";
import { createNotification } from "@/lib/services/notifications/notification-service";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "onboarding:execute")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { createSuppliers, createRules } = body;

  // Re-run analysis to get fresh data
  const analysis = await analyzeNewClient(ctx.companyId);

  let suppliersCreated = 0;
  let rulesCreated = 0;

  // Create suppliers (confidence >= medium)
  if (createSuppliers) {
    const eligibleSuppliers = analysis.suppliers.filter(
      (s) => !s.existsInSystem && (s.confidence === "high" || s.confidence === "medium")
    );

    for (const s of eligibleSuppliers) {
      try {
        await prisma.supplier.create({
          data: {
            companyId: ctx.companyId,
            nameNormalized: s.name,
            nameVariants: [s.name],
            defaultAccountCode: s.suggestedAccount,
            defaultCategory: s.suggestedCategory,
          },
        });
        suppliersCreated++;
      } catch {
        // Skip duplicates or other errors
      }
    }
  }

  // Create rules (confidence >= medium)
  if (createRules) {
    const eligibleRules = analysis.suggestedRules.filter(
      (r) => r.confidence === "high" || r.confidence === "medium"
    );

    for (const r of eligibleRules) {
      try {
        const ruleType = r.type === "supplier_to_account" ? "supplier_default"
          : r.type === "category_mapping" ? "category_mapping"
          : "vat_logic";

        await prisma.rule.create({
          data: {
            companyId: ctx.companyId,
            name: "Onboarding: " + r.description,
            ruleType: ruleType as any,
            conditions: {
              source: "onboarding",
              supplierName: r.supplierName || undefined,
              category: r.category || undefined,
            },
            actions: {
              accountCode: r.accountCode || undefined,
              category: r.category || undefined,
            },
            priority: 10,
            isActive: true,
          },
        });
        rulesCreated++;
      } catch {
        // Skip errors
      }
    }
  }

  // Notification
  await createNotification({
    companyId: ctx.companyId,
    type: "system_alert",
    title: "Onboarding-Analyse angewendet",
    body: suppliersCreated + " Lieferanten und " + rulesCreated + " Regeln erstellt",
    severity: "success",
    link: "/trustee/onboarding",
  });

  // Audit log
  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "onboarding_applied",
    entityType: "company",
    entityId: ctx.companyId,
    changes: {
      suppliersCreated: { before: null, after: suppliersCreated },
      rulesCreated: { before: null, after: rulesCreated },
    },
  });

  return NextResponse.json({
    suppliersCreated,
    rulesCreated,
    analysis,
  });
}
