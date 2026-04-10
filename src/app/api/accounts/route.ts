import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";

const VALID_ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];
const VALID_GOVERNANCE = ["ai_suggest", "ai_autopilot", "manual_only", "locked"];

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const url = request.nextUrl.searchParams;
  const type = url.get("type");
  const active = url.get("active");
  const governance = url.get("governance");
  const search = url.get("search");
  const tree = url.get("tree");

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (type) where.accountType = type;
  if (active !== null && active !== undefined && active !== "") {
    where.isActive = active === "true";
  }
  if (governance) where.aiGovernance = governance;
  if (search) {
    where.OR = [
      { accountNumber: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const accounts = await prisma.account.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { accountNumber: "asc" }],
  });

  if (tree === "true") {
    const grouped: Record<string, typeof accounts> = {};
    for (const acc of accounts) {
      const parent = acc.parentNumber ?? "__root__";
      if (!grouped[parent]) grouped[parent] = [];
      grouped[parent].push(acc);
    }
    return NextResponse.json({ accounts: grouped, total: accounts.length });
  }

  return NextResponse.json({ accounts, total: accounts.length });
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { accountNumber, name, accountType, category, parentNumber, bclass, groupCode, currency, aiGovernance, allowedDocTypes, allowedVatCodes, notes } = body;

    if (!accountNumber?.trim()) return NextResponse.json({ error: "Kontonummer ist erforderlich" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: "Bezeichnung ist erforderlich" }, { status: 400 });
    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json({ error: "Ungültiger Kontotyp" }, { status: 400 });
    }
    if (aiGovernance && !VALID_GOVERNANCE.includes(aiGovernance)) {
      return NextResponse.json({ error: "Ungültige AI-Berechtigung" }, { status: 400 });
    }

    const existing = await prisma.account.findUnique({
      where: { companyId_accountNumber: { companyId: ctx.companyId, accountNumber: accountNumber.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: "Kontonummer existiert bereits" }, { status: 409 });
    }

    const account = await prisma.account.create({
      data: {
        companyId: ctx.companyId,
        accountNumber: accountNumber.trim(),
        name: name.trim(),
        accountType,
        category: category ?? null,
        parentNumber: parentNumber ?? null,
        bclass: bclass ?? null,
        groupCode: groupCode ?? null,
        currency: currency ?? null,
        aiGovernance: aiGovernance ?? "ai_suggest",
        allowedDocTypes: allowedDocTypes ?? null,
        allowedVatCodes: allowedVatCodes ?? null,
        notes: notes ?? null,
      },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "account_created",
      entityType: "account",
      entityId: account.id,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
