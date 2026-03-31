import { prisma } from "@/lib/db";

/**
 * Generate a sequential document number: BP-{YEAR}-{NNNN}
 * Uses the database to find the max existing number for the year.
 */
export async function generateDocumentNumber(
  companyId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BP-${year}-`;

  // Find the highest existing document number for this year and company
  const latest = await prisma.document.findFirst({
    where: {
      companyId,
      documentNumber: { startsWith: prefix },
    },
    orderBy: { documentNumber: "desc" },
    select: { documentNumber: true },
  });

  let nextSeq = 1;
  if (latest?.documentNumber) {
    const seqStr = latest.documentNumber.replace(prefix, "");
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}
