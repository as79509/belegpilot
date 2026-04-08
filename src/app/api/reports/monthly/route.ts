import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const dateFilter = { companyId, createdAt: { gte: startDate, lt: endDate } };

  const [
    documentsTotal,
    documentsReviewed,
    documentsFailed,
    autoApprovedCount,
    manualReviewCount,
    grossAgg,
    avgConfidence,
    journalEntriesCount,
    recurringGenerated,
    topSuppliersRaw,
  ] = await Promise.all([
    prisma.document.count({ where: dateFilter }),
    prisma.document.count({
      where: { ...dateFilter, status: { in: ["ready", "exported"] } },
    }),
    prisma.document.count({
      where: { ...dateFilter, status: "failed" },
    }),
    prisma.document.count({
      where: { ...dateFilter, processingDecision: "auto_ready" },
    }),
    prisma.document.count({
      where: {
        ...dateFilter,
        reviewedBy: { not: null },
        reviewStatus: { in: ["approved", "rejected"] },
      },
    }),
    prisma.document.aggregate({
      where: dateFilter,
      _sum: { grossAmount: true },
    }),
    prisma.document.aggregate({
      where: { ...dateFilter, confidenceScore: { not: null } },
      _avg: { confidenceScore: true },
    }),
    prisma.journalEntry.count({
      where: { companyId, entryDate: { gte: startDate, lt: endDate } },
    }),
    prisma.journalEntry.count({
      where: {
        companyId,
        entryDate: { gte: startDate, lt: endDate },
        isRecurring: true,
      },
    }),
    prisma.document.groupBy({
      by: ["supplierId"],
      where: { ...dateFilter, supplierId: { not: null } },
      _sum: { grossAmount: true },
      _count: true,
      orderBy: { _sum: { grossAmount: "desc" } },
      take: 5,
    }),
  ]);

  // Resolve supplier names for top suppliers
  const supplierIds = topSuppliersRaw
    .map((s) => s.supplierId)
    .filter((id): id is string => id !== null);

  const suppliers = supplierIds.length > 0
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, nameNormalized: true },
      })
    : [];

  const supplierMap = new Map(suppliers.map((s) => [s.id, s.nameNormalized]));

  const topSuppliers = topSuppliersRaw.map((s) => ({
    name: supplierMap.get(s.supplierId!) || "Unbekannt",
    amount: Number(s._sum.grossAmount || 0),
    count: s._count,
  }));

  const totalGrossAmount = Number(grossAgg._sum.grossAmount || 0);
  const confidence = avgConfidence._avg.confidenceScore || 0;
  const errorRate = documentsTotal > 0 ? documentsFailed / documentsTotal : 0;

  return NextResponse.json({
    year,
    month,
    documentsTotal,
    documentsReviewed,
    documentsFailed,
    autoApprovedCount,
    manualReviewCount,
    totalGrossAmount,
    topSuppliers,
    avgConfidence: Math.round(confidence * 1000) / 1000,
    errorRate: Math.round(errorRate * 10000) / 10000,
    journalEntriesCount,
    recurringGenerated,
  });
}
