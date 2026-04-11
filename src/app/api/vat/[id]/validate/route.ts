import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { validateVatReturn } from "@/lib/services/vat/vat-validator";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "vat:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId: ctx.companyId },
  });

  if (!vatReturn) {
    return NextResponse.json({ error: "MwSt-Abrechnung nicht gefunden" }, { status: 404 });
  }

  if (vatReturn.status !== "draft") {
    return NextResponse.json(
      { error: "Nur Entwürfe können validiert werden" },
      { status: 400 }
    );
  }

  // Fetch company VAT settings
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: { vatLiable: true, vatMethod: true, vatInterval: true },
  });

  // Build calculation from stored values
  const n = (v: any) => Number(v) || 0;
  const steuerbarerUmsatz = n(vatReturn.ziffer200) - (n(vatReturn.ziffer205) + n(vatReturn.ziffer220) + n(vatReturn.ziffer221) + n(vatReturn.ziffer225) + n(vatReturn.ziffer230) + n(vatReturn.ziffer235));
  const totalSteuer = n(vatReturn.steuer302) + n(vatReturn.steuer312) + n(vatReturn.steuer342) + n(vatReturn.steuer382);
  const totalVorsteuer = n(vatReturn.ziffer400) + n(vatReturn.ziffer405) + n(vatReturn.ziffer410) - n(vatReturn.ziffer415) - n(vatReturn.ziffer420);

  const calc = {
    ziffer200: n(vatReturn.ziffer200), ziffer205: n(vatReturn.ziffer205),
    ziffer220: n(vatReturn.ziffer220), ziffer221: n(vatReturn.ziffer221),
    ziffer225: n(vatReturn.ziffer225), ziffer230: n(vatReturn.ziffer230),
    ziffer235: n(vatReturn.ziffer235), steuerbarerUmsatz,
    ziffer302: n(vatReturn.ziffer302), steuer302: n(vatReturn.steuer302),
    ziffer312: n(vatReturn.ziffer312), steuer312: n(vatReturn.steuer312),
    ziffer342: n(vatReturn.ziffer342), steuer342: n(vatReturn.steuer342),
    ziffer382: n(vatReturn.ziffer382), steuer382: n(vatReturn.steuer382),
    totalSteuer,
    ziffer400: n(vatReturn.ziffer400), ziffer405: n(vatReturn.ziffer405),
    ziffer410: n(vatReturn.ziffer410), ziffer415: n(vatReturn.ziffer415),
    ziffer420: n(vatReturn.ziffer420), totalVorsteuer,
    zahllast: totalSteuer - totalVorsteuer,
    documentCount: vatReturn.documentCount, journalCount: vatReturn.journalCount,
  };

  const warnings = validateVatReturn(calc, company);

  // Check for blocking errors
  const hasErrors = warnings.some((w) => w.severity === "error");

  if (hasErrors) {
    // Save warnings but don't advance status
    await prisma.vatReturn.update({
      where: { id },
      data: { warnings: warnings as any },
    });

    return NextResponse.json({
      validated: false,
      warnings,
      message: "Validierung fehlgeschlagen — Fehler müssen korrigiert werden",
    });
  }

  // Advance to validated
  const updated = await prisma.vatReturn.update({
    where: { id },
    data: {
      status: "validated",
      validatedAt: new Date(),
      validatedBy: ctx.session.user.id,
      warnings: warnings as any,
    },
  });

  return NextResponse.json({
    validated: true,
    vatReturn: updated,
    warnings,
  });
}
