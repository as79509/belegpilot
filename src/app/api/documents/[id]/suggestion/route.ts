import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { generateSuggestion } from "@/lib/services/suggestions/suggestion-engine";
import { logAudit } from "@/lib/services/audit/audit-service";
import { trackCorrections } from "@/lib/services/corrections/correction-tracker";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Prüfe ob bereits eine BookingSuggestion existiert
    const existing = await prisma.bookingSuggestion.findFirst({
      where: { documentId: id, companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    // Neue Suggestion generieren
    const suggestion = await generateSuggestion(ctx.companyId, {
      supplierNameNormalized: document.supplierNameNormalized,
      grossAmount: document.grossAmount ? Number(document.grossAmount) : null,
      currency: document.currency,
      vatRatesDetected: document.vatRatesDetected,
      expenseCategory: document.expenseCategory,
      documentType: document.documentType,
    });

    if (!suggestion) {
      return NextResponse.json({ suggestion: null, message: "Kein Vorschlag verfügbar" });
    }

    // Speichere als BookingSuggestion
    const saved = await prisma.bookingSuggestion.create({
      data: {
        companyId: ctx.companyId,
        documentId: id,
        suggestedAccount: suggestion.suggestedAccount,
        suggestedCategory: suggestion.suggestedCategory,
        suggestedVatCode: suggestion.suggestedVatCode,
        suggestedCostCenter: suggestion.suggestedCostCenter,
        confidenceLevel: suggestion.confidenceLevel,
        confidenceScore: suggestion.confidenceScore,
        reasoning: suggestion.reasoning as any,
        matchedDocCount: suggestion.matchedDocCount,
        consistencyRate: suggestion.consistencyRate,
      },
    });

    return NextResponse.json(saved);
  } catch (error: any) {
    console.error("[Suggestion GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (!hasPermission(ctx.session.user.role, "documents:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, modifiedTo } = body as {
      action: "accepted" | "rejected" | "modified";
      modifiedTo?: { account?: string; category?: string; costCenter?: string; vatCode?: string };
    };

    if (!["accepted", "rejected", "modified"].includes(action)) {
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    }

    // Finde die aktuelle Suggestion
    const suggestion = await prisma.bookingSuggestion.findFirst({
      where: { documentId: id, companyId: ctx.companyId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    if (!suggestion) {
      return NextResponse.json({ error: "Kein ausstehender Vorschlag gefunden" }, { status: 404 });
    }

    // Update die Suggestion
    const updateData: any = { status: action };
    if (action === "accepted") {
      updateData.acceptedAt = new Date();
    } else if (action === "rejected") {
      updateData.rejectedAt = new Date();
    } else if (action === "modified") {
      updateData.acceptedAt = new Date();
      updateData.userModifiedTo = modifiedTo || {};
    }

    const updated = await prisma.bookingSuggestion.update({
      where: { id: suggestion.id },
      data: updateData,
    });

    // Wenn accepted: Document mit vorgeschlagenen Werten aktualisieren
    if (action === "accepted") {
      const docUpdate: any = {};
      if (suggestion.suggestedAccount) docUpdate.accountCode = suggestion.suggestedAccount;
      if (suggestion.suggestedCategory) docUpdate.expenseCategory = suggestion.suggestedCategory;
      if (suggestion.suggestedCostCenter) docUpdate.costCenter = suggestion.suggestedCostCenter;
      if (Object.keys(docUpdate).length > 0) {
        await prisma.document.updateMany({
          where: { id, companyId: ctx.companyId },
          data: docUpdate,
        });
      }
    }

    // Wenn modified: Document mit den modifizierten Werten aktualisieren
    if (action === "modified" && modifiedTo) {
      const docUpdate: any = {};
      if (modifiedTo.account) docUpdate.accountCode = modifiedTo.account;
      if (modifiedTo.category) docUpdate.expenseCategory = modifiedTo.category;
      if (modifiedTo.costCenter) docUpdate.costCenter = modifiedTo.costCenter;
      if (Object.keys(docUpdate).length > 0) {
        await prisma.document.updateMany({
          where: { id, companyId: ctx.companyId },
          data: docUpdate,
        });
      }

      // Korrekturen tracken: Vorschlag → tatsächlich gewählter Wert
      try {
        const doc = await prisma.document.findFirst({
          where: { id, companyId: ctx.companyId },
          select: { supplierId: true },
        });
        await trackCorrections(
          ctx.companyId,
          id,
          ctx.session.user.id,
          {
            accountCode: suggestion.suggestedAccount,
            expenseCategory: suggestion.suggestedCategory,
            costCenter: suggestion.suggestedCostCenter,
          },
          {
            accountCode: modifiedTo.account ?? null,
            expenseCategory: modifiedTo.category ?? null,
            costCenter: modifiedTo.costCenter ?? null,
          },
          doc?.supplierId ?? null,
          "suggestion_modified"
        );
      } catch (trackErr) {
        console.error("[Suggestion POST] trackCorrections failed", trackErr);
      }
    }

    // Audit-Log
    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: `suggestion_${action}`,
      entityType: "booking_suggestion",
      entityId: suggestion.id,
      changes: action === "modified" && modifiedTo
        ? { modifiedTo: { before: null, after: modifiedTo } }
        : undefined,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Suggestion POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
