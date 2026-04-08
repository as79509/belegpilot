import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const [statusCounts, todayCount, avgConfidence, escalatedCount, unverifiedSupplierDocCount] = await Promise.all([
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
    prisma.document.count({
      where: {
        companyId,
        processingDecision: "needs_review",
        status: "needs_review",
      },
    }),
    prisma.document.count({
      where: {
        companyId,
        status: { in: ["needs_review", "ready", "extracted", "validated"] },
        supplier: { isVerified: false },
      },
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
    escalated: escalatedCount,
    unverified_suppliers: unverifiedSupplierDocCount,
  });
}
