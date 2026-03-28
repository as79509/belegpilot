import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;

  const [statusCounts, todayCount, avgConfidence] = await Promise.all([
    prisma.document.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    }),
    prisma.document.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.document.aggregate({
      where: { companyId, confidenceScore: { not: null } },
      _avg: { confidenceScore: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    counts[row.status] = row._count;
    total += row._count;
  }

  return NextResponse.json({
    uploaded: counts.uploaded || 0,
    processing: counts.processing || 0,
    needs_review: counts.needs_review || 0,
    ready: counts.ready || 0,
    failed: counts.failed || 0,
    exported: counts.exported || 0,
    total,
    today_uploaded: todayCount,
    avg_confidence: avgConfidence._avg.confidenceScore || 0,
  });
}
