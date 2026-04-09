import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!["admin", "reviewer", "trustee"].includes(ctx.session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const status = (searchParams.get("status") || "open") as "open" | "promoted" | "dismissed";
  const supplierId = searchParams.get("supplierId");
  const minOccurrences = parseInt(searchParams.get("minOccurrences") || "3", 10);

  const where: Record<string, any> = { companyId: ctx.companyId, status };
  if (status === "open") {
    where.occurrences = { gte: minOccurrences };
  }
  if (supplierId) {
    // Wenn supplierId="" übergeben wird, nicht zurückgeben — nur echte IDs erlaubt
    if (supplierId.trim() === "") {
      return NextResponse.json({ patterns: [] });
    }
    where.supplierId = supplierId;
  }

  const patterns = await prisma.correctionPattern.findMany({
    where: where as any,
    orderBy: { occurrences: "desc" },
    take: 100,
  });

  // Lade Entity-Namen für promoted Patterns
  const ruleIds = patterns
    .filter((p) => p.promotedTo === "rule" && p.promotedEntityId)
    .map((p) => p.promotedEntityId!);
  const knowledgeIds = patterns
    .filter((p) => p.promotedTo === "knowledge" && p.promotedEntityId)
    .map((p) => p.promotedEntityId!);

  const [rules, knowledgeItems] = await Promise.all([
    ruleIds.length > 0
      ? prisma.rule.findMany({
          where: { id: { in: ruleIds }, companyId: ctx.companyId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    knowledgeIds.length > 0
      ? prisma.knowledgeItem.findMany({
          where: { id: { in: knowledgeIds }, companyId: ctx.companyId },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const ruleMap = new Map(rules.map((r) => [r.id, r.name]));
  const knowledgeMap = new Map(knowledgeItems.map((k) => [k.id, k.title]));

  return NextResponse.json({
    patterns: patterns.map((p) => {
      let promotedEntityName: string | null = null;
      if (p.promotedTo === "rule" && p.promotedEntityId) {
        promotedEntityName = ruleMap.get(p.promotedEntityId) || null;
      } else if (p.promotedTo === "knowledge" && p.promotedEntityId) {
        promotedEntityName = knowledgeMap.get(p.promotedEntityId) || null;
      }
      return {
        id: p.id,
        field: p.field,
        fromValue: p.fromValue,
        toValue: p.toValue,
        occurrences: p.occurrences,
        supplierId: p.supplierId || null,
        supplierName: p.supplierName,
        firstSeenAt: p.firstSeenAt,
        lastSeenAt: p.lastSeenAt,
        status: p.status,
        promotedTo: p.promotedTo,
        promotedEntityId: p.promotedEntityId,
        promotedEntityName,
        promotedAt: p.promotedAt,
        dismissedAt: p.dismissedAt,
        dismissedReason: p.dismissedReason,
      };
    }),
  });
}
