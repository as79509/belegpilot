import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const url = request.nextUrl.searchParams;
  const status = url.get("status");

  const where: Record<string, any> = { companyId: ctx.companyId, isActive: true };
  if (status) where.bananaMappingStatus = status;

  const accounts = await prisma.account.findMany({
    where,
    select: {
      id: true,
      accountNumber: true,
      name: true,
      accountType: true,
      bananaAccountNumber: true,
      bananaDescription: true,
      bananaMappingStatus: true,
      bananaMappingNotes: true,
    },
    orderBy: [
      {
        bananaMappingStatus: "asc", // unmapped first alphabetically (blocked, mapped, uncertain, unmapped)
      },
      { accountNumber: "asc" },
    ],
  });

  // Custom sort: unmapped → uncertain → blocked → mapped
  const statusOrder: Record<string, number> = { unmapped: 0, uncertain: 1, blocked: 2, mapped: 3 };
  accounts.sort((a, b) => {
    const oa = statusOrder[a.bananaMappingStatus] ?? 4;
    const ob = statusOrder[b.bananaMappingStatus] ?? 4;
    if (oa !== ob) return oa - ob;
    return a.accountNumber.localeCompare(b.accountNumber);
  });

  return NextResponse.json({ accounts, total: accounts.length });
}
