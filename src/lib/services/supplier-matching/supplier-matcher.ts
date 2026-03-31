import { prisma } from "@/lib/db";
import { stringSimilarity } from "string-similarity-js";

export interface SupplierMatch {
  supplierId: string;
  matchType: "vat_number" | "iban" | "name_similarity";
  confidence: number;
}

export async function findMatchingSupplier(
  companyId: string,
  vatNumber: string | null,
  iban: string | null,
  nameNormalized: string | null
): Promise<SupplierMatch | null> {
  // 1. Exact match by VAT number (highest priority)
  if (vatNumber?.trim()) {
    const match = await prisma.supplier.findFirst({
      where: { companyId, vatNumber: vatNumber.trim(), isActive: true },
      select: { id: true },
    });
    if (match) {
      return { supplierId: match.id, matchType: "vat_number", confidence: 1.0 };
    }
  }

  // 2. Exact match by IBAN
  if (iban?.trim()) {
    const normalized = iban.replace(/\s/g, "").toUpperCase();
    const match = await prisma.supplier.findFirst({
      where: { companyId, isActive: true, iban: { not: null } },
      select: { id: true, iban: true },
    });
    // Check all suppliers with IBAN
    const suppliers = await prisma.supplier.findMany({
      where: { companyId, isActive: true, iban: { not: null } },
      select: { id: true, iban: true },
    });
    for (const s of suppliers) {
      if (s.iban && s.iban.replace(/\s/g, "").toUpperCase() === normalized) {
        return { supplierId: s.id, matchType: "iban", confidence: 1.0 };
      }
    }
  }

  // 3. Fuzzy match by normalized name
  if (nameNormalized?.trim()) {
    const suppliers = await prisma.supplier.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameNormalized: true, nameVariants: true },
    });

    let bestMatch: SupplierMatch | null = null;
    let bestScore = 0;

    for (const s of suppliers) {
      // Check against normalized name
      const score = stringSimilarity(
        nameNormalized.toLowerCase(),
        s.nameNormalized.toLowerCase()
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          supplierId: s.id,
          matchType: "name_similarity",
          confidence: score,
        };
      }

      // Check against name variants
      const variants = (s.nameVariants as string[]) || [];
      for (const variant of variants) {
        const vScore = stringSimilarity(
          nameNormalized.toLowerCase(),
          variant.toLowerCase()
        );
        if (vScore > bestScore) {
          bestScore = vScore;
          bestMatch = {
            supplierId: s.id,
            matchType: "name_similarity",
            confidence: vScore,
          };
        }
      }
    }

    // Only auto-link if similarity > 0.85
    if (bestMatch && bestScore >= 0.85) {
      return bestMatch;
    }
  }

  return null;
}

export async function createSupplierFromDocument(
  companyId: string,
  nameNormalized: string,
  nameRaw: string | null,
  vatNumber: string | null,
  iban: string | null
): Promise<string> {
  const variants = nameRaw && nameRaw !== nameNormalized ? [nameRaw] : [];

  const supplier = await prisma.supplier.create({
    data: {
      companyId,
      nameNormalized,
      nameVariants: variants,
      vatNumber: vatNumber || null,
      iban: iban || null,
      isVerified: false,
      documentCount: 1,
    },
  });

  return supplier.id;
}
