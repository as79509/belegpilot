import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { calculateVatReturn } from "@/lib/services/vat/vat-calculator";
import type { VatCreateResponse } from "@/lib/services/vat/vat-contract";
import { validateVatReturn } from "@/lib/services/vat/vat-validator";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const year = searchParams.get("year");
  const quarter = searchParams.get("quarter");
  const status = searchParams.get("status");

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (year) where.year = parseInt(year);
  if (quarter) where.quarter = parseInt(quarter);
  if (status) where.status = status;

  const vatReturns = await prisma.vatReturn.findMany({
    where: where as any,
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  });

  return NextResponse.json({ returns: vatReturns });
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "vat:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const { year, quarter, periodType: rawPeriodType } = body;

  if (!year || !quarter) {
    return NextResponse.json(
      { error: "Jahr und Quartal/Periode sind erforderlich" },
      { status: 400 }
    );
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: { vatLiable: true, vatMethod: true, vatInterval: true },
  });

  const periodType = rawPeriodType || company.vatInterval || "quarterly";

  // Check for existing return
  const existing = await prisma.vatReturn.findUnique({
    where: {
      companyId_year_quarter_periodType: {
        companyId: ctx.companyId,
        year: parseInt(year),
        quarter: parseInt(quarter),
        periodType,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Für diese Periode existiert bereits eine MwSt-Abrechnung" },
      { status: 409 }
    );
  }

  // Calculate
  const calc = await calculateVatReturn(ctx.companyId, parseInt(year), parseInt(quarter), periodType);

  // Validate
  const warnings = validateVatReturn(calc, company);

  // Create draft
  const vatReturn = await prisma.vatReturn.create({
    data: {
      companyId: ctx.companyId,
      year: parseInt(year),
      quarter: parseInt(quarter),
      periodType,
      status: "draft",
      ziffer200: calc.ziffer200,
      ziffer205: calc.ziffer205,
      ziffer220: calc.ziffer220,
      ziffer221: calc.ziffer221,
      ziffer225: calc.ziffer225,
      ziffer230: calc.ziffer230,
      ziffer235: calc.ziffer235,
      ziffer302: calc.ziffer302,
      ziffer312: calc.ziffer312,
      ziffer342: calc.ziffer342,
      ziffer382: calc.ziffer382,
      steuer302: calc.steuer302,
      steuer312: calc.steuer312,
      steuer342: calc.steuer342,
      steuer382: calc.steuer382,
      ziffer400: calc.ziffer400,
      ziffer405: calc.ziffer405,
      ziffer410: calc.ziffer410,
      ziffer415: calc.ziffer415,
      ziffer420: calc.ziffer420,
      warnings: warnings as any,
      documentCount: calc.documentCount,
      journalCount: calc.journalCount,
    },
  });

  const response: VatCreateResponse<typeof vatReturn> = {
    vatReturn,
    calculation: calc,
    warnings,
  };

  return NextResponse.json(response, { status: 201 });
}
