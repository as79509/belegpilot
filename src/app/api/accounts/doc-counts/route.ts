import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const results = await prisma.document.groupBy({
    by: ["accountCode"],
    where: { companyId: ctx.companyId, accountCode: { not: null } },
    _count: { id: true },
  });

  const counts: Record<string, number> = {};
  for (const r of results) {
    if (r.accountCode) counts[r.accountCode] = r._count.id;
  }

  return NextResponse.json({ counts });
}
