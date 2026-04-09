import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

/**
 * Aggregiert Intelligence-Daten zu einem Lieferanten:
 * - Verknüpfte Regeln (durch supplierName condition)
 * - Verknüpfte Knowledge Items (durch relatedSupplier)
 * - Offene Eskalationen (Tasks)
 * - Top-Konten / Top-Kategorien
 * - Timeline (Audit-Events)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { id } = await params;
    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!supplier) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const supplierName = supplier.nameNormalized;

    // 1. Verknüpfte Regeln finden — alle Rules laden, nach supplierName-Bedingung filtern
    const allRules = await prisma.rule.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { priority: "desc" },
    });

    const matchedRules = allRules.filter((rule) => {
      const conditions = (rule.conditions as any[]) || [];
      return conditions.some((c) => {
        if (c.field !== "supplierName") return false;
        const val = String(c.value || "").toLowerCase();
        const supplierLower = supplierName.toLowerCase();
        if (c.operator === "equals") return val === supplierLower;
        if (c.operator === "contains") return supplierLower.includes(val) || val.includes(supplierLower);
        return false;
      });
    });

    // 2. Verknüpfte Knowledge Items
    const knowledgeItems = await prisma.knowledgeItem.findMany({
      where: {
        companyId: ctx.companyId,
        relatedSupplier: { equals: supplierName, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. Offene Eskalationen (Tasks) für Dokumente dieses Lieferanten
    const openEscalations = await prisma.task.findMany({
      where: {
        companyId: ctx.companyId,
        status: { in: ["open", "in_progress"] },
        taskType: { in: ["escalation", "review_needed"] },
        document: { supplierNameNormalized: supplierName },
      },
      select: {
        id: true, title: true, taskType: true, priority: true,
        createdAt: true, status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // 4. Top-Kategorien
    const categoryDocs = await prisma.document.findMany({
      where: {
        companyId: ctx.companyId,
        supplierNameNormalized: supplierName,
        status: { in: ["ready", "exported"] },
        reviewStatus: "approved",
      },
      select: {
        accountCode: true,
        expenseCategory: true,
      },
      take: 200,
    });

    const accountCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const d of categoryDocs) {
      if (d.accountCode) accountCounts[d.accountCode] = (accountCounts[d.accountCode] || 0) + 1;
      if (d.expenseCategory) categoryCounts[d.expenseCategory] = (categoryCounts[d.expenseCategory] || 0) + 1;
    }
    const topAccounts = Object.entries(accountCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([account, count]) => ({
        account,
        count,
        percent: categoryDocs.length > 0 ? Math.round((count / categoryDocs.length) * 100) : 0,
      }));
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count,
        percent: categoryDocs.length > 0 ? Math.round((count / categoryDocs.length) * 100) : 0,
      }));

    // 5. Korrekturen letzte 30 Tage (CorrectionEvents)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const corrections = await prisma.correctionEvent.findMany({
      where: {
        companyId: ctx.companyId,
        supplierId: supplier.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true, field: true, originalValue: true, correctedValue: true,
        createdAt: true, source: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 6. Timeline aus Audit-Log + supplier-Daten
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        companyId: ctx.companyId,
        entityType: "supplier",
        entityId: supplier.id,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, createdAt: true, changes: true },
    });

    // Last document date
    const lastDoc = await prisma.document.findFirst({
      where: {
        companyId: ctx.companyId,
        supplierNameNormalized: supplierName,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const verifiedEntry = auditEntries.find((e) => e.action === "supplier_verified");
    const defaultsEntry = auditEntries.find((e) => e.action === "supplier_defaults_updated");

    const timeline = {
      createdAt: supplier.createdAt,
      verifiedAt: verifiedEntry?.createdAt || null,
      defaultsSetAt: defaultsEntry?.createdAt || null,
      lastDocumentAt: lastDoc?.createdAt || null,
    };

    return NextResponse.json({
      rules: matchedRules.map((r) => ({
        id: r.id,
        name: r.name,
        ruleType: r.ruleType,
        isActive: r.isActive,
        actions: r.actions,
      })),
      knowledge: knowledgeItems.map((k) => ({
        id: k.id,
        title: k.title,
        category: k.category,
        version: k.version,
      })),
      escalations: openEscalations,
      topAccounts,
      topCategories,
      corrections,
      correctionCount: corrections.length,
      timeline,
    });
  } catch (error: any) {
    console.error("[supplier intelligence]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
