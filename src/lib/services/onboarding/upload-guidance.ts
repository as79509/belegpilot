import { prisma } from "@/lib/db";

export interface UploadCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  priority: "high" | "medium" | "low";
  currentCount: number;
  recommendedMin: number;
  recommendedMax: number;
  examples: string[];
  status: "empty" | "insufficient" | "sufficient" | "good";
}

export interface UploadGuidance {
  categories: UploadCategory[];
  overallProgress: number;
  readyForBootstrapping: boolean;
  totalDocuments: number;
  totalCategories: number;
}

interface CategoryDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  priority: "high" | "medium" | "low";
  recommendedMin: number;
  recommendedMax: number;
  examples: string[];
  categoryPatterns: string[];
  supplierPatterns: string[];
  typePatterns: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "typical", label: "Typische Lieferantenrechnungen",
    description: "Rechnungen von h\u00e4ufigen Lieferanten",
    icon: "FileText", priority: "high", recommendedMin: 10, recommendedMax: 20,
    examples: ["B\u00fcromaterial", "IT-Services", "Reinigung"],
    categoryPatterns: [], supplierPatterns: [], typePatterns: ["invoice", "credit_note"],
  },
  {
    id: "recurring", label: "Wiederkehrende Rechnungen",
    description: "Monatlich oder quartalsweise anfallend",
    icon: "Repeat", priority: "high", recommendedMin: 5, recommendedMax: 10,
    examples: ["Miete", "Strom", "Telefon", "Internet"],
    categoryPatterns: ["miete", "strom", "telefon", "internet", "hosting", "abo"],
    supplierPatterns: ["swisscom", "sunrise", "salt", "ewz", "sbb"],
    typePatterns: [],
  },
  {
    id: "rent", label: "Mietvertrag / Pachtvertrag",
    description: "Gesch\u00e4ftsmiete und Nebenkosten",
    icon: "Home", priority: "medium", recommendedMin: 1, recommendedMax: 2,
    examples: ["Gesch\u00e4ftsmiete", "Lagermiete"],
    categoryPatterns: ["miete", "pacht", "gesch\u00e4ftsmiete", "nebenkosten"],
    supplierPatterns: [], typePatterns: [],
  },
  {
    id: "insurance", label: "Versicherungspolicen",
    description: "Betriebliche Versicherungen",
    icon: "Shield", priority: "medium", recommendedMin: 1, recommendedMax: 3,
    examples: ["Betriebshaftpflicht", "Sachversicherung"],
    categoryPatterns: ["versicherung", "police", "haftpflicht"],
    supplierPatterns: ["zurich", "axa", "helvetia", "mobiliar", "basler", "allianz"],
    typePatterns: [],
  },
  {
    id: "leasing", label: "Leasing / Finanzierung",
    description: "Leasing-Raten und Kreditvertr\u00e4ge",
    icon: "Car", priority: "low", recommendedMin: 0, recommendedMax: 2,
    examples: ["Fahrzeugleasing", "Maschinenleasing"],
    categoryPatterns: ["leasing", "finanzierung", "kredit"],
    supplierPatterns: [], typePatterns: [],
  },
  {
    id: "special", label: "Sonderf\u00e4lle",
    description: "Spezielle Belegarten",
    icon: "AlertTriangle", priority: "low", recommendedMin: 0, recommendedMax: 3,
    examples: ["Auslandsrechnungen", "Privatanteil", "Barbelege"],
    categoryPatterns: ["privatanteil", "ausland", "spesen", "reise"],
    supplierPatterns: [], typePatterns: ["receipt", "other"],
  },
];

function matchDoc(
  doc: { expenseCategory: string | null; supplierNameNormalized: string | null; documentType: string },
  cat: CategoryDef
): boolean {
  const c = (doc.expenseCategory || "").toLowerCase();
  const s = (doc.supplierNameNormalized || "").toLowerCase();
  if (cat.categoryPatterns.length > 0 && cat.categoryPatterns.some((p) => c.includes(p))) return true;
  if (cat.supplierPatterns.length > 0 && cat.supplierPatterns.some((p) => s.includes(p))) return true;
  if (cat.typePatterns.length > 0 && cat.typePatterns.includes(doc.documentType)) return true;
  return false;
}

function getStatus(count: number, min: number, max: number): UploadCategory["status"] {
  if (count === 0) return "empty";
  if (count < Math.max(min, 1)) return "insufficient";
  if (count >= max) return "good";
  return "sufficient";
}

export async function getUploadGuidance(companyId: string): Promise<UploadGuidance> {
  const docs = await prisma.document.findMany({
    where: { companyId, status: { notIn: ["rejected", "failed"] } },
    select: { expenseCategory: true, supplierNameNormalized: true, documentType: true },
  });

  // Count per category; specific categories take priority, "typical" is fallback
  const assigned = new Set<number>();
  const counts: Record<string, number> = {};

  for (const cat of CATEGORIES) {
    if (cat.id === "typical") continue;
    let count = 0;
    for (let i = 0; i < docs.length; i++) {
      if (assigned.has(i)) continue;
      if (matchDoc(docs[i], cat)) { count++; assigned.add(i); }
    }
    counts[cat.id] = count;
  }
  // Typical = unassigned invoices
  counts["typical"] = docs.filter((d, i) => !assigned.has(i) && (d.documentType === "invoice" || d.documentType === "credit_note")).length;

  const categories: UploadCategory[] = CATEGORIES.map((c) => ({
    id: c.id, label: c.label, description: c.description, icon: c.icon,
    priority: c.priority, examples: c.examples,
    recommendedMin: c.recommendedMin, recommendedMax: c.recommendedMax,
    currentCount: counts[c.id] || 0,
    status: getStatus(counts[c.id] || 0, c.recommendedMin, c.recommendedMax),
  }));

  // Progress weighted by priority
  const weights = { high: 3, medium: 2, low: 1 };
  let tw = 0, aw = 0;
  for (const cat of categories) {
    const w = weights[cat.priority];
    tw += w;
    aw += w * Math.min((cat.currentCount) / Math.max(cat.recommendedMin, 1), 1);
  }
  const overallProgress = tw > 0 ? aw / tw : 0;

  const totalCategories = categories.filter((c) => c.currentCount > 0).length;
  const readyForBootstrapping = docs.length >= 5 && totalCategories >= 2;

  return { categories, overallProgress, readyForBootstrapping, totalDocuments: docs.length, totalCategories };
}
