import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Group export records by externalId (batch ID)
  const records = await prisma.exportRecord.findMany({
    where: {
      document: { companyId: session.user.companyId },
    },
    include: {
      document: {
        select: { id: true, supplierNameNormalized: true, grossAmount: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Group by batch
  const batches = new Map<string, { batchId: string; createdAt: Date; count: number; status: string }>();
  for (const r of records) {
    const batchId = r.externalId || r.id;
    if (!batches.has(batchId)) {
      batches.set(batchId, {
        batchId,
        createdAt: r.createdAt,
        count: 0,
        status: r.status,
      });
    }
    batches.get(batchId)!.count++;
  }

  return NextResponse.json(Array.from(batches.values()));
}
