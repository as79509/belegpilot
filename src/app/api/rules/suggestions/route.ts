import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

interface Suggestion {
  supplierName: string;
  supplierId: string;
  pattern: "category" | "account" | "cost_center";
  value: string;
  documentCount: number;
  message: string;
}

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const companyId = ctx.companyId;

  // Load recent approved documents with supplier + category
  const docs = await prisma.document.findMany({
    where: {
      companyId,
      status: { in: ["ready", "exported"] },
      supplierId: { not: null },
    },
    select: {
      supplierId: true,
      supplierNameNormalized: true,
      expenseCategory: true,
      accountCode: true,
      costCenter: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Load existing rules to avoid duplicates
  const existingRules = await prisma.rule.findMany({
    where: { companyId, isActive: true },
    select: { conditions: true },
  });

  const ruledSuppliers = new Set<string>();
  for (const rule of existingRules) {
    const conditions = rule.conditions as any[];
    if (Array.isArray(conditions)) {
      for (const c of conditions) {
        if (c.field === "supplierName" && c.value) {
          ruledSuppliers.add(c.value.toLowerCase());
        }
      }
    }
  }

  // Group by supplier
  const supplierGroups = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (!doc.supplierId) continue;
    const key = doc.supplierId;
    if (!supplierGroups.has(key)) supplierGroups.set(key, []);
    supplierGroups.get(key)!.push(doc);
  }

  const suggestions: Suggestion[] = [];

  for (const [supplierId, supplierDocs] of supplierGroups) {
    if (supplierDocs.length < 2) continue;

    const name = supplierDocs[0].supplierNameNormalized || "";
    if (ruledSuppliers.has(name.toLowerCase())) continue;

    // Check consistent category
    const categories = supplierDocs.map((d) => d.expenseCategory).filter(Boolean);
    if (categories.length >= 2) {
      const allSame = categories.every((c) => c === categories[0]);
      if (allSame && categories[0]) {
        suggestions.push({
          supplierName: name,
          supplierId,
          pattern: "category",
          value: categories[0],
          documentCount: categories.length,
          message: `${name} wird immer als ${categories[0]} kategorisiert (${categories.length} Belege)`,
        });
      }
    }

    // Check consistent account code
    const accounts = supplierDocs.map((d) => d.accountCode).filter(Boolean);
    if (accounts.length >= 2 && !suggestions.some((s) => s.supplierId === supplierId)) {
      const allSame = accounts.every((a) => a === accounts[0]);
      if (allSame && accounts[0]) {
        suggestions.push({
          supplierName: name,
          supplierId,
          pattern: "account",
          value: accounts[0],
          documentCount: accounts.length,
          message: `${name} wird immer auf Konto ${accounts[0]} gebucht (${accounts.length} Belege)`,
        });
      }
    }
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 10) });
}
