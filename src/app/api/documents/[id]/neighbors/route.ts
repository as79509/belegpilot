import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const filter = searchParams.get("filter") || "needs_review";

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (filter && filter !== "all") {
    where.status = filter;
  }

  // Load all documents in the queue, sorted by confidenceScore ASC
  const docs = await prisma.document.findMany({
    where: where as any,
    select: { id: true },
    orderBy: { confidenceScore: "asc" },
  });

  const idx = docs.findIndex((d) => d.id === id);
  const previousId = idx > 0 ? docs[idx - 1].id : null;
  const nextId = idx >= 0 && idx < docs.length - 1 ? docs[idx + 1].id : null;
  const currentPosition = idx >= 0 ? idx + 1 : 0;

  return NextResponse.json({
    previousId,
    nextId,
    currentPosition,
    totalInQueue: docs.length,
  });
}
