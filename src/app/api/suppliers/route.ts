import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const verified = searchParams.get("verified");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const sortBy = searchParams.get("sortBy") || "nameNormalized";
  const sortOrder = (searchParams.get("sortOrder") || "asc") as "asc" | "desc";

  const where: Record<string, any> = {
    companyId: ctx.companyId,
    isActive: true,
  };

  if (verified === "true") where.isVerified = true;
  if (verified === "false") where.isVerified = false;

  if (search) {
    where.OR = [
      { nameNormalized: { contains: search, mode: "insensitive" } },
      { vatNumber: { contains: search, mode: "insensitive" } },
      { iban: { contains: search, mode: "insensitive" } },
    ];
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where: where as any,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where: where as any }),
  ]);

  return NextResponse.json({
    suppliers,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    if (!hasPermission(ctx.session.user.role, "suppliers:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const nameNormalized = typeof body.nameNormalized === "string" ? body.nameNormalized.trim() : "";

    if (!nameNormalized) {
      return NextResponse.json({ error: "Lieferantenname ist erforderlich" }, { status: 400 });
    }

    const paymentTermDays =
      body.paymentTermDays === null || body.paymentTermDays === undefined || body.paymentTermDays === ""
        ? null
        : Number.parseInt(String(body.paymentTermDays), 10);

    if (paymentTermDays !== null && Number.isNaN(paymentTermDays)) {
      return NextResponse.json({ error: "Zahlungsfrist muss eine ganze Zahl sein" }, { status: 400 });
    }

    const existing = await prisma.supplier.findFirst({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        nameNormalized: {
          equals: nameNormalized,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "Lieferant existiert bereits" }, { status: 409 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyId: ctx.companyId,
        nameNormalized,
        nameVariants: [nameNormalized],
        vatNumber: body.vatNumber?.trim() || null,
        iban: body.iban?.trim() || null,
        defaultCategory: body.defaultCategory?.trim() || null,
        defaultAccountCode: body.defaultAccountCode?.trim() || null,
        paymentTermDays,
      },
    });

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "supplier_created",
      entityType: "supplier",
      entityId: supplier.id,
      changes: {
        created: {
          before: null,
          after: {
            nameNormalized: supplier.nameNormalized,
            vatNumber: supplier.vatNumber,
            iban: supplier.iban,
            defaultCategory: supplier.defaultCategory,
            defaultAccountCode: supplier.defaultAccountCode,
            paymentTermDays: supplier.paymentTermDays,
          },
        },
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Lieferant konnte nicht erstellt werden" }, { status: 500 });
  }
}
