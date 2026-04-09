import { prisma } from "@/lib/db";

/**
 * Schwellwert: Ab wie vielen gleichen Korrekturen wird ein Pattern aktiv?
 */
export const PATTERN_THRESHOLD = 3;

export type TrackableField = "accountCode" | "expenseCategory" | "costCenter";

export interface TrackableFields {
  accountCode: string | null;
  expenseCategory: string | null;
  costCenter: string | null;
}

const FIELDS: TrackableField[] = ["accountCode", "expenseCategory", "costCenter"];

/**
 * Wird aufgerufen beim Approve — vergleicht AI-Ergebnis mit finalen Werten.
 * Erstellt CorrectionEvent + aggregiert in CorrectionPattern.
 */
export async function trackCorrections(
  companyId: string,
  documentId: string,
  userId: string,
  originalFields: TrackableFields,
  finalFields: TrackableFields,
  supplierId: string | null,
  source: string = "review"
): Promise<number> {
  let correctionCount = 0;
  // Postgres unique constraint behandelt NULL als distinct — wir nutzen "" als Sentinel.
  const supplierKey = supplierId || "";

  for (const field of FIELDS) {
    const original = originalFields[field];
    const corrected = finalFields[field];

    if (!corrected) continue; // Kein finaler Wert → kein Vergleich
    if (original === corrected) continue; // Gleich → keine Korrektur

    // 1. CorrectionEvent erstellen
    await prisma.correctionEvent.create({
      data: {
        companyId,
        documentId,
        supplierId,
        field,
        originalValue: original,
        correctedValue: corrected,
        correctedBy: userId,
        source,
      },
    });
    correctionCount++;

    // 2. CorrectionPattern upsert
    const existingPattern = await prisma.correctionPattern.findUnique({
      where: {
        companyId_supplierId_field_fromValue_toValue: {
          companyId,
          supplierId: supplierKey,
          field,
          fromValue: original || "",
          toValue: corrected,
        },
      },
    });

    if (existingPattern) {
      await prisma.correctionPattern.update({
        where: { id: existingPattern.id },
        data: {
          occurrences: existingPattern.occurrences + 1,
          lastSeenAt: new Date(),
        },
      });
    } else {
      await prisma.correctionPattern.create({
        data: {
          companyId,
          supplierId: supplierKey,
          supplierName: null,
          field,
          fromValue: original || "",
          toValue: corrected,
          occurrences: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
    }
  }

  return correctionCount;
}

/**
 * Liefert Korrekturmuster, die actionable sind:
 * - status = "open"
 * - occurrences >= PATTERN_THRESHOLD
 */
export async function getActionablePatterns(companyId: string) {
  return prisma.correctionPattern.findMany({
    where: {
      companyId,
      status: "open",
      occurrences: { gte: PATTERN_THRESHOLD },
    },
    orderBy: { occurrences: "desc" },
    take: 20,
  });
}
