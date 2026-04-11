import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const items = await prisma.expectedDocument.findMany({
    where: { companyId: ctx.companyId },
    include: { contract: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "expected-docs:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const item = await prisma.expectedDocument.create({
      data: {
        companyId: ctx.companyId,
        name: body.name,
        counterparty: body.counterparty,
        frequency: body.frequency || "monthly",
        expectedAmount: body.expectedAmount != null ? Number(body.expectedAmount) : null,
        tolerancePercent: body.tolerancePercent != null ? Number(body.tolerancePercent) : 20,
        debitAccount: body.debitAccount || null,
        linkedContractId: body.linkedContractId || null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
