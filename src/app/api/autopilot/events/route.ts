import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10) || 10, 100);

  const events = await prisma.autopilotEvent.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      mode: true,
      decision: true,
      blockedBy: true,
      confidenceScore: true,
      suggestedAccount: true,
      supplierName: true,
      documentId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}
