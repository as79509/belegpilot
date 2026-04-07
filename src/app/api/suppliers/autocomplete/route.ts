import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") || "";

  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId: session.user.companyId,
      isActive: true,
      nameNormalized: { contains: q, mode: "insensitive" },
    },
    select: { id: true, nameNormalized: true },
    take: 10,
    orderBy: { documentCount: "desc" },
  });

  return NextResponse.json({
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.nameNormalized })),
  });
}
