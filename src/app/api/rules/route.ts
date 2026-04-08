import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!["admin", "reviewer", "trustee"].includes(ctx.session.user.role))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const rules = await prisma.rule.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (session.user.role !== "admin")
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const body = await request.json();
    const { name, ruleType, conditions, actions, priority, isActive } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    if (!["supplier_default", "auto_approve", "category_mapping", "vat_logic"].includes(ruleType))
      return NextResponse.json({ error: "Ungültiger Regeltyp" }, { status: 400 });
    if (!Array.isArray(conditions)) return NextResponse.json({ error: "Bedingungen müssen ein Array sein" }, { status: 400 });
    if (!Array.isArray(actions)) return NextResponse.json({ error: "Aktionen müssen ein Array sein" }, { status: 400 });

    const rule = await prisma.rule.create({
      data: {
        companyId: session.user.companyId,
        name,
        ruleType,
        conditions,
        actions,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
