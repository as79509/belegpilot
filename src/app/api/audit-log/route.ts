import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const entityType = searchParams.get("entityType");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const where: Record<string, any> = { companyId: session.user.companyId };
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Enrich entries with document numbers where applicable
  const docIds = entries
    .filter((e) => e.entityType === "document")
    .map((e) => e.entityId);
  const docs = docIds.length
    ? await prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, documentNumber: true },
      })
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d.documentNumber]));

  const enriched = entries.map((e) => ({
    ...e,
    documentNumber: e.entityType === "document" ? docMap.get(e.entityId) || null : null,
  }));

  // Also return users for the filter dropdown
  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: { id: true, name: true },
  });

  console.log(`[Audit-Log] Returned ${entries.length} entries (page ${page})`);

  return NextResponse.json({
    entries: enriched,
    users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
