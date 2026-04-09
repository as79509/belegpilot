import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  icon?: string;
}

interface SearchGroup {
  category: string;
  items: SearchItem[];
}

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Try to detect a year/month query like "März 2026" or "April"
  let monthYearFilter: { year?: number; month?: number } | null = null;
  const lowerQ = q.toLowerCase();
  const monthIdx = MONTH_NAMES.findIndex((m) => lowerQ.includes(m.toLowerCase()));
  const yearMatch = q.match(/\b(20\d{2})\b/);
  if (monthIdx >= 0 || yearMatch) {
    monthYearFilter = {};
    if (monthIdx >= 0) monthYearFilter.month = monthIdx + 1;
    if (yearMatch) monthYearFilter.year = parseInt(yearMatch[1], 10);
  }

  const [documents, suppliers, tasks, rules, knowledge, periods] = await Promise.all([
    prisma.document.findMany({
      where: {
        companyId,
        OR: [
          { documentNumber: { contains: q, mode: "insensitive" } },
          { supplierNameNormalized: { contains: q, mode: "insensitive" } },
          { supplierNameRaw: { contains: q, mode: "insensitive" } },
          { invoiceNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        documentNumber: true,
        supplierNameNormalized: true,
        supplierNameRaw: true,
        invoiceNumber: true,
        grossAmount: true,
        currency: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: {
        companyId,
        nameNormalized: { contains: q, mode: "insensitive" },
      },
      select: { id: true, nameNormalized: true, vatNumber: true },
      orderBy: { nameNormalized: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        companyId,
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, status: true, priority: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.rule.findMany({
      where: {
        companyId,
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, ruleType: true, isActive: true },
      orderBy: { name: "asc" },
      take: 3,
    }),
    prisma.knowledgeItem.findMany({
      where: {
        companyId,
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, category: true },
      orderBy: { title: "asc" },
      take: 3,
    }),
    monthYearFilter
      ? prisma.monthlyPeriod.findMany({
          where: {
            companyId,
            ...(monthYearFilter.year ? { year: monthYearFilter.year } : {}),
            ...(monthYearFilter.month ? { month: monthYearFilter.month } : {}),
          },
          select: { id: true, year: true, month: true, status: true },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 3,
        })
      : Promise.resolve([] as Array<{ id: string; year: number; month: number; status: string }>),
  ]);

  const results: SearchGroup[] = [];

  if (documents.length > 0) {
    results.push({
      category: "documents",
      items: documents.map((d) => ({
        id: d.id,
        title: d.documentNumber || d.invoiceNumber || "Beleg",
        subtitle: [
          d.supplierNameNormalized || d.supplierNameRaw,
          d.grossAmount != null ? `${d.grossAmount} ${d.currency || "CHF"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        url: `/documents/${d.id}`,
      })),
    });
  }

  if (suppliers.length > 0) {
    results.push({
      category: "suppliers",
      items: suppliers.map((s) => ({
        id: s.id,
        title: s.nameNormalized,
        subtitle: s.vatNumber || undefined,
        url: `/suppliers/${s.id}`,
      })),
    });
  }

  if (periods.length > 0) {
    results.push({
      category: "periods",
      items: periods.map((p) => ({
        id: p.id,
        title: `${MONTH_NAMES[p.month - 1]} ${p.year}`,
        subtitle: p.status,
        url: `/periods`,
      })),
    });
  }

  if (tasks.length > 0) {
    results.push({
      category: "tasks",
      items: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: `${t.priority} · ${t.status}`,
        url: `/tasks`,
      })),
    });
  }

  if (rules.length > 0) {
    results.push({
      category: "rules",
      items: rules.map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: r.isActive ? r.ruleType : `${r.ruleType} (inaktiv)`,
        url: `/rules`,
      })),
    });
  }

  if (knowledge.length > 0) {
    results.push({
      category: "knowledge",
      items: knowledge.map((k) => ({
        id: k.id,
        title: k.title,
        subtitle: k.category,
        url: `/settings/ai`,
      })),
    });
  }

  return NextResponse.json({ results });
}
