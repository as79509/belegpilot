import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const accounts = await prisma.bankAccount.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "bank:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { iban, name, bankName, currency } = body;

  if (!iban || !name) {
    return NextResponse.json({ error: "IBAN und Name sind erforderlich" }, { status: 400 });
  }

  const account = await prisma.bankAccount.create({
    data: {
      companyId: ctx.companyId,
      iban: iban.replace(/\s/g, ""),
      name,
      bankName: bankName || null,
      currency: currency || "CHF",
    },
  });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "bank_account_created",
    entityType: "bank_account",
    entityId: account.id,
    changes: {
      created: {
        before: null,
        after: {
          iban: account.iban,
          name: account.name,
          bankName: account.bankName,
          currency: account.currency,
          isActive: account.isActive,
        },
      },
    },
  });

  return NextResponse.json(account, { status: 201 });
}
