import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const companyId = session.user.companyId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyUsage = await prisma.aiUsage.aggregate({
    where: { companyId, createdAt: { gte: monthStart } },
    _sum: { estimatedCostUsd: true },
    _count: true,
  });

  const monthlyCost = Number(monthlyUsage._sum.estimatedCostUsd || 0);
  const documentCount = monthlyUsage._count;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings = (company?.settings as Record<string, any>) || {};
  const monthlyBudget = settings.aiMonthlyBudgetUsd || 50;

  const percentUsed = monthlyBudget > 0 ? Math.round((monthlyCost / monthlyBudget) * 100) : 0;

  return NextResponse.json({
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    monthlyBudget,
    percentUsed,
    documentCount,
    isOverBudget: monthlyCost > monthlyBudget,
    isWarning: percentUsed >= 80,
  });
}
