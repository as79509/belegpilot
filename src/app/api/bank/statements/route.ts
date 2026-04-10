import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const statements = await prisma.bankStatement.findMany({
    where: { companyId: ctx.companyId },
    include: {
      bankAccount: { select: { name: true, iban: true } },
      _count: {
        select: { transactions: true },
      },
    },
    orderBy: { importedAt: "desc" },
  });

  // Compute matched count per statement
  const result = await Promise.all(
    statements.map(async (stmt) => {
      const matchedCount = await prisma.bankTransaction.count({
        where: {
          statementId: stmt.id,
          matchStatus: { in: ["auto_matched", "manual_matched"] },
        },
      });
      return {
        ...stmt,
        matchedCount,
      };
    })
  );

  return NextResponse.json(result);
}
