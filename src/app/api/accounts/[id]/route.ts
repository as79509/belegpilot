import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const account = await prisma.account.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });

  return NextResponse.json(account);
}

const ALLOWED_PATCH_FIELDS = [
  "name", "category", "parentNumber", "aiGovernance",
  "allowedDocTypes", "allowedVatCodes", "notes", "isActive",
  "sortOrder", "bananaAccountNumber", "bananaDescription",
  "bananaMappingStatus", "bananaMappingNotes",
  "bclass", "groupCode", "currency",
];

const VALID_GOVERNANCE = ["ai_suggest", "ai_autopilot", "manual_only", "locked"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const account = await prisma.account.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });

    const body = await request.json();

    if (body.accountNumber !== undefined) {
      return NextResponse.json({ error: "Kontonummer kann nicht geändert werden" }, { status: 400 });
    }

    if (body.aiGovernance && !VALID_GOVERNANCE.includes(body.aiGovernance)) {
      return NextResponse.json({ error: "Ungültige AI-Berechtigung" }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    for (const f of ALLOWED_PATCH_FIELDS) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const changes = computeChanges(account as any, updateData, Object.keys(updateData));
    const updated = await prisma.account.update({ where: { id }, data: updateData });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "account_updated",
      entityType: "account",
      entityId: id,
      changes,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const account = await prisma.account.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });

    // Check if account is used in documents or journal entries
    const [docCount, journalCount] = await Promise.all([
      prisma.document.count({
        where: { companyId: ctx.companyId, accountCode: account.accountNumber },
      }),
      prisma.journalEntry.count({
        where: {
          companyId: ctx.companyId,
          OR: [
            { debitAccount: account.accountNumber },
            { creditAccount: account.accountNumber },
          ],
        },
      }),
    ]);

    const usageCount = docCount + journalCount;

    // Soft-delete: set isActive = false
    await prisma.account.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "account_deactivated",
      entityType: "account",
      entityId: id,
      changes: { isActive: { before: true, after: false } },
    });

    return NextResponse.json({
      success: true,
      warning: usageCount > 0
        ? `Konto wird in ${usageCount} Belegen/Buchungen verwendet`
        : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
