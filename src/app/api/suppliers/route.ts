import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

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
