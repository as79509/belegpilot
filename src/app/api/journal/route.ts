import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { checkPeriodLock } from "@/lib/services/cockpit/period-guard";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const entryType = searchParams.get("entryType");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (entryType) where.entryType = entryType;
  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom) where.entryDate.gte = new Date(dateFrom);
    if (dateTo) where.entryDate.lte = new Date(dateTo + "T23:59:59Z");
  }

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where: where as any,
      include: {
        user: { select: { name: true } },
        document: { select: { id: true, documentNumber: true } },
      },
      orderBy: { entryDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.journalEntry.count({ where: where as any }),
  ]);

  return NextResponse.json({ entries, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

async function validateAccountsAgainstPlan(
  companyId: string,
  debitAccount: string,
  creditAccount: string
): Promise<{ warnings: string[]; lockedError: string | null }> {
  const warnings: string[] = [];
  let lockedError: string | null = null;

  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: { accountNumber: true, aiGovernance: true },
  });

  // If no chart of accounts exists, skip validation (legacy)
  if (accounts.length === 0) return { warnings, lockedError };

  const accountMap = new Map(accounts.map((a) => [a.accountNumber, a.aiGovernance]));

  for (const [label, code] of [["Soll", debitAccount], ["Haben", creditAccount]] as const) {
    if (!code) continue;
    const governance = accountMap.get(code);
    if (governance === undefined) {
      warnings.push(`${label}-Konto ${code} ist nicht im Kontenplan`);
    } else if (governance === "locked") {
      lockedError = `Konto ${code} ist gesperrt`;
    }
  }

  return { warnings, lockedError };
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    if (!hasPermission(ctx.session.user.role, "journal:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();

    // Check period lock
    if (body.entryDate) {
      const lock = await checkPeriodLock(ctx.companyId, new Date(body.entryDate));
      if (lock.locked) {
        return NextResponse.json({ error: lock.message }, { status: 409 });
      }
    }

    // Validate accounts against chart of accounts
    const { warnings, lockedError } = await validateAccountsAgainstPlan(
      ctx.companyId,
      body.debitAccount,
      body.creditAccount
    );
    if (lockedError) {
      return NextResponse.json({ error: lockedError }, { status: 400 });
    }

    const entry = await prisma.journalEntry.create({
      data: {
        companyId: ctx.companyId,
        entryDate: new Date(body.entryDate),
        debitAccount: body.debitAccount,
        creditAccount: body.creditAccount,
        amount: body.amount,
        currency: body.currency || "CHF",
        vatAmount: body.vatAmount || null,
        vatRate: body.vatRate || null,
        description: body.description,
        reference: body.reference || null,
        documentId: body.documentId || null,
        entryType: body.entryType || "manual",
        createdBy: ctx.session.user.id,
      },
    });

    return NextResponse.json({ entry, warnings }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
