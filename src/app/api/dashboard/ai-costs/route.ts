import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonthlyUsage } from "@/lib/services/ai/cost-tracker";

const USD_TO_CHF = 0.88;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const usage = await getMonthlyUsage(
    session.user.companyId,
    now.getFullYear(),
    now.getMonth() + 1
  );

  console.log("[AI-Costs] Monthly usage fetched");

  return NextResponse.json({
    documentCount: usage.documentCount,
    totalInputTokens: usage.totalInputTokens,
    totalOutputTokens: usage.totalOutputTokens,
    estimatedCostChf: Math.round(usage.totalCostUsd * USD_TO_CHF * 100) / 100,
  });
}
