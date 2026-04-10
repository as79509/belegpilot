import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { generateEch0217Xml } from "@/lib/services/vat/vat-xml";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!vatReturn) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { name: true, uid: true },
  });
  if (!company) return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });

  const vrData = {
    year: vatReturn.year,
    quarter: vatReturn.quarter,
    periodType: vatReturn.periodType,
    status: vatReturn.status,
    ziffer200: Number(vatReturn.ziffer200),
    ziffer205: Number(vatReturn.ziffer205),
    ziffer220: Number(vatReturn.ziffer220),
    ziffer221: Number(vatReturn.ziffer221),
    ziffer225: Number(vatReturn.ziffer225),
    ziffer230: Number(vatReturn.ziffer230),
    ziffer235: Number(vatReturn.ziffer235),
    ziffer302: Number(vatReturn.ziffer302),
    ziffer312: Number(vatReturn.ziffer312),
    ziffer342: Number(vatReturn.ziffer342),
    ziffer382: Number(vatReturn.ziffer382),
    steuer302: Number(vatReturn.steuer302),
    steuer312: Number(vatReturn.steuer312),
    steuer342: Number(vatReturn.steuer342),
    steuer382: Number(vatReturn.steuer382),
    ziffer400: Number(vatReturn.ziffer400),
    ziffer405: Number(vatReturn.ziffer405),
    ziffer410: Number(vatReturn.ziffer410),
    ziffer415: Number(vatReturn.ziffer415),
    ziffer420: Number(vatReturn.ziffer420),
  };

  const xml = generateEch0217Xml(vrData, company);

  const periodLabel = vatReturn.periodType === "semi_annual"
    ? `h${vatReturn.quarter}`
    : `q${vatReturn.quarter}`;
  const fileName = `mwst-${periodLabel}-${vatReturn.year}.xml`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Implementation-Status": "placeholder",
    },
  });
}
