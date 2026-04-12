import { prisma } from "@/lib/db";

export interface UploadGuidanceCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  priority: "high" | "medium" | "low";
  currentCount: number;
  recommendedCount: number;
  examples: string[];
}

export interface UploadGuidance {
  categories: UploadGuidanceCategory[];
  overallProgress: number;
  readyForBootstrapping: boolean;
}

const CATEGORIES: Omit<UploadGuidanceCategory, "currentCount">[] = [
  {
    id: "typical",
    label: "Typische Lieferantenrechnungen",
    description: "Rechnungen von h\u00e4ufigen Lieferanten",
    icon: "FileText",
    priority: "high",
    recommendedCount: 15,
    examples: ["B\u00fcromaterial", "Reinigung", "IT-Services"],
  },
  {
    id: "recurring",
    label: "Wiederkehrende Rechnungen",
    description: "Monatlich oder quartalsweise anfallend",
    icon: "Repeat",
    priority: "high",
    recommendedCount: 8,
    examples: ["Miete", "Strom", "Telefon", "Internet"],
  },
  {
    id: "rent",
    label: "Mietvertrag / Pachtvertrag",
    description: "Gesch\u00e4ftsmiete und Nebenkosten",
    icon: "Home",
    priority: "medium",
    recommendedCount: 2,
    examples: ["Gesch\u00e4ftsmiete", "Lagermiete"],
  },
  {
    id: "insurance",
    label: "Versicherungspolicen",
    description: "Betriebliche Versicherungen",
    icon: "Shield",
    priority: "medium",
    recommendedCount: 2,
    examples: ["Betriebshaftpflicht", "Sachversicherung"],
  },
  {
    id: "leasing",
    label: "Leasing / Finanzierung",
    description: "Leasing-Raten und Kreditvertr\u00e4ge",
    icon: "Car",
    priority: "low",
    recommendedCount: 1,
    examples: ["Fahrzeug-Leasing", "Maschinen"],
  },
  {
    id: "special",
    label: "Sonderf\u00e4lle",
    description: "Spezielle Belegarten",
    icon: "AlertTriangle",
    priority: "low",
    recommendedCount: 2,
    examples: ["Auslandsrechnungen", "Privatanteil", "Barbelege"],
  },
];

// Keywords per category for matching documents
const CATEGORY_MATCHERS: Record<string, { categories: string[]; suppliers: string[]; types: string[] }> = {
  typical: {
    categories: [],
    suppliers: [],
    types: ["invoice", "credit_note"],
  },
  recurring: {
    categories: ["miete", "strom", "telefon", "internet", "hosting", "abo"],
    suppliers: ["swisscom", "sunrise", "salt", "ewz", "ewl", "sbb"],
    types: [],
  },
  rent: {
    categories: ["miete", "pacht", "geschäftsmiete", "nebenkosten"],
    suppliers: [],
    types: [],
  },
  insurance: {
    categories: ["versicherung", "police", "haftpflicht", "sachversicherung"],
    suppliers: ["zurich", "axa", "helvetia", "mobiliar", "basler", "allianz"],
    types: [],
  },
  leasing: {
    categories: ["leasing", "finanzierung", "kredit"],
    suppliers: [],
    types: [],
  },
  special: {
    categories: ["privatanteil", "ausland", "spesen", "reise"],
    suppliers: [],
    types: ["receipt", "other"],
  },
};

function matchesCategory(
  doc: { expenseCategory: string | null; supplierNameNormalized: string | null; documentType: string },
  matcher: { categories: string[]; suppliers: string[]; types: string[] }
): boolean {
  const cat = (doc.expenseCategory || "").toLowerCase();
  const sup = (doc.supplierNameNormalized || "").toLowerCase();
  const typ = doc.documentType;

  if (matcher.categories.length > 0 && matcher.categories.some((k) => cat.includes(k))) return true;
  if (matcher.suppliers.length > 0 && matcher.suppliers.some((k) => sup.includes(k))) return true;
  if (matcher.types.length > 0 && matcher.types.includes(typ)) return true;
  return false;
}

export async function getUploadGuidance(companyId: string): Promise<UploadGuidance> {
  const docs = await prisma.document.findMany({
    where: { companyId, status: { notIn: ["rejected", "failed"] } },
    select: {
      expenseCategory: true,
      supplierNameNormalized: true,
      documentType: true,
    },
  });

  const categoryCounts: Record<string, number> = {};
  const assignedDocs = new Set<number>();

  // Count docs per category (a doc can match multiple, first match wins for counting)
  for (const catDef of CATEGORIES) {
    const matcher = CATEGORY_MATCHERS[catDef.id];
    if (!matcher) { categoryCounts[catDef.id] = 0; continue; }

    let count = 0;
    for (let i = 0; i < docs.length; i++) {
      if (assignedDocs.has(i)) continue;
      if (matchesCategory(docs[i], matcher)) {
        count++;
        // Only assign "typical" as fallback — specific categories take priority
        if (catDef.id !== "typical") assignedDocs.add(i);
      }
    }
    categoryCounts[catDef.id] = count;
  }

  // Typical = all invoices not assigned to a specific category
  categoryCounts["typical"] = docs.filter(
    (d, i) => !assignedDocs.has(i) && (d.documentType === "invoice" || d.documentType === "credit_note")
  ).length;

  const categories: UploadGuidanceCategory[] = CATEGORIES.map((c) => ({
    ...c,
    currentCount: categoryCounts[c.id] || 0,
  }));

  // Progress: weighted by priority
  const weights = { high: 3, medium: 2, low: 1 };
  let totalWeight = 0;
  let achievedWeight = 0;
  for (const cat of categories) {
    const w = weights[cat.priority];
    totalWeight += w;
    const ratio = Math.min(cat.currentCount / Math.max(cat.recommendedCount, 1), 1);
    achievedWeight += w * ratio;
  }
  const overallProgress = totalWeight > 0 ? achievedWeight / totalWeight : 0;

  // Ready: >= 5 docs from at least 3 different categories
  const categoriesWithDocs = categories.filter((c) => c.currentCount > 0).length;
  const totalDocs = docs.length;
  const readyForBootstrapping = totalDocs >= 5 && categoriesWithDocs >= 3;

  return { categories, overallProgress, readyForBootstrapping };
}
