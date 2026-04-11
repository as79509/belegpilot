import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const status = searchParams.get("status") || "active";

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (category) where.category = category;
  if (status !== "all") where.status = status;

  const assets = await prisma.asset.findMany({
    where: where as any,
    orderBy: { acquisitionDate: "desc" },
  });

  return NextResponse.json(assets);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    if (!hasPermission(ctx.session.user.role, "assets:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const cost = parseFloat(body.acquisitionCost);

    const asset = await prisma.asset.create({
      data: {
        companyId: ctx.companyId,
        name: body.name,
        category: body.category,
        acquisitionDate: new Date(body.acquisitionDate),
        acquisitionCost: cost,
        residualValue: body.residualValue ? parseFloat(body.residualValue) : 0,
        usefulLifeMonths: parseInt(body.usefulLifeMonths),
        depreciationMethod: body.depreciationMethod || "linear",
        degressiveRate: body.degressiveRate ? parseFloat(body.degressiveRate) : null,
        assetAccount: body.assetAccount,
        depreciationAccount: body.depreciationAccount,
        location: body.location || null,
        costCenter: body.costCenter || null,
        description: body.description || null,
        serialNumber: body.serialNumber || null,
        supplier: body.supplier || null,
        licensePlate: body.licensePlate || null,
        privateUsePercent: body.privateUsePercent ? parseFloat(body.privateUsePercent) : null,
        bookValue: cost,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
