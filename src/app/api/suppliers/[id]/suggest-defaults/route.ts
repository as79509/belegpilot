import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { analyzeSupplierPatterns } from "@/lib/services/suggestions/supplier-patterns";
import { logAudit } from "@/lib/services/audit/audit-service";

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

    const pattern = await analyzeSupplierPatterns(ctx.companyId, supplier.nameNormalized);

    if (!pattern) {
      return NextResponse.json({
        eligible: false,
        suggestions: {},
        pattern: null,
        reason: "Noch keine genehmigten Belege vorhanden",
      });
    }

    // Eligibility-Bedingungen
    const hasMinDocs = pattern.totalApprovedDocs >= 5;
    const hasStableAccount = pattern.accountStability >= 0.8;
    const isVerified = pattern.isVerified;

    // Eskalationen: Prüfe ob es offene Tasks (escalations) gibt für diesen Lieferanten
    const openEscalations = await prisma.task.count({
      where: {
        companyId: ctx.companyId,
        status: { in: ["open", "in_progress"] },
        taskType: { in: ["escalation", "review_needed"] },
        document: { supplierNameNormalized: supplier.nameNormalized },
      },
    });
    const noActiveEscalations = openEscalations === 0;

    const eligible = hasMinDocs && hasStableAccount && isVerified && noActiveEscalations;

    let reason = "";
    if (!hasMinDocs) reason = "Mindestens 5 genehmigte Belege nötig";
    else if (!hasStableAccount) reason = "Konto-Stabilität unter 80%";
    else if (!isVerified) reason = "Lieferant nicht verifiziert";
    else if (!noActiveEscalations) reason = "Aktive Eskalationen für diesen Lieferanten";
    else reason = "Bereit für Standardwert-Vorschlag";

    // Bestimme häufigste Kategorie aus Historie
    const categoryDocs = await prisma.document.findMany({
      where: {
        companyId: ctx.companyId,
        supplierNameNormalized: supplier.nameNormalized,
        status: { in: ["ready", "exported"] },
        reviewStatus: "approved",
        expenseCategory: { not: null },
      },
      select: { expenseCategory: true },
      take: 50,
    });
    const catCounts: Record<string, number> = {};
    for (const d of categoryDocs) {
      if (d.expenseCategory) catCounts[d.expenseCategory] = (catCounts[d.expenseCategory] || 0) + 1;
    }
    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const suggestions = {
      defaultAccountCode: pattern.dominantAccount,
      defaultCategory: topCategory,
      dominantVatRate: pattern.dominantVatRate,
    };

    return NextResponse.json({ eligible, suggestions, pattern, reason });
  } catch (error: any) {
    console.error("[suggest-defaults GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "suppliers:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { acceptAccount, acceptCategory } = body as {
      acceptAccount?: boolean;
      acceptCategory?: boolean;
    };

    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!supplier) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Re-evaluate pattern um sicher zu gehen
    const pattern = await analyzeSupplierPatterns(ctx.companyId, supplier.nameNormalized);
    if (!pattern) {
      return NextResponse.json({ error: "Keine Muster verfügbar" }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    const changes: Record<string, { before: any; after: any }> = {};

    if (acceptAccount && pattern.dominantAccount) {
      updateData.defaultAccountCode = pattern.dominantAccount;
      changes.defaultAccountCode = { before: supplier.defaultAccountCode, after: pattern.dominantAccount };
    }

    if (acceptCategory) {
      const categoryDocs = await prisma.document.findMany({
        where: {
          companyId: ctx.companyId,
          supplierNameNormalized: supplier.nameNormalized,
          status: { in: ["ready", "exported"] },
          reviewStatus: "approved",
          expenseCategory: { not: null },
        },
        select: { expenseCategory: true },
        take: 50,
      });
      const catCounts: Record<string, number> = {};
      for (const d of categoryDocs) {
        if (d.expenseCategory) catCounts[d.expenseCategory] = (catCounts[d.expenseCategory] || 0) + 1;
      }
      const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      if (topCategory) {
        updateData.defaultCategory = topCategory;
        changes.defaultCategory = { before: supplier.defaultCategory, after: topCategory };
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Keine Felder zur Aktualisierung ausgewählt" }, { status: 400 });
    }

    const updateResult = await prisma.supplier.updateMany({
      where: { id, companyId: ctx.companyId },
      data: updateData,
    });
    if (updateResult.count === 0) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.supplier.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!updated) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "supplier_defaults_updated",
      entityType: "supplier",
      entityId: id,
      changes,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[suggest-defaults POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
