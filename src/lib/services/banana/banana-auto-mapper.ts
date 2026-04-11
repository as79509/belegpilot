import { prisma } from "@/lib/db";

/** Swiss standard VAT rate → Banana VAT code mapping */
const SWISS_VAT_MAP: Record<number, { code: string; label: string }> = {
  8.1: { code: "V81", label: "Vorsteuer Normalsatz 8.1%" },
  2.6: { code: "V26", label: "Vorsteuer reduziert 2.6%" },
  3.8: { code: "V38", label: "Vorsteuer Sondersatz 3.8%" },
  0: { code: "V00", label: "Steuerfrei" },
};

export async function autoMapAccounts(companyId: string): Promise<{
  mapped: number;
  skipped: number;
  suggestions: Array<{
    accountNumber: string;
    suggestedBananaNumber: string;
    confidence: "high" | "medium" | "low";
  }>;
}> {
  let mapped = 0;
  let skipped = 0;
  const suggestions: Array<{
    accountNumber: string;
    suggestedBananaNumber: string;
    confidence: "high" | "medium" | "low";
  }> = [];

  // 1. Auto-map accounts without bananaAccountNumber
  const unmappedAccounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      bananaMappingStatus: "unmapped",
    },
  });

  for (const acc of unmappedAccounts) {
    const num = parseInt(acc.accountNumber, 10);

    if (!acc.bananaAccountNumber && num >= 1000 && num <= 9999) {
      // Standard KMU chart: Banana number = account number (convention match)
      await prisma.account.update({
        where: { id: acc.id },
        data: {
          bananaAccountNumber: acc.accountNumber,
          bananaMappingStatus: "mapped",
        },
      });
      mapped++;
      suggestions.push({
        accountNumber: acc.accountNumber,
        suggestedBananaNumber: acc.accountNumber,
        confidence: "high",
      });
    } else if (acc.bananaAccountNumber) {
      // Already has a banana number but status was unmapped — mark as uncertain
      await prisma.account.update({
        where: { id: acc.id },
        data: { bananaMappingStatus: "uncertain" },
      });
      suggestions.push({
        accountNumber: acc.accountNumber,
        suggestedBananaNumber: acc.bananaAccountNumber,
        confidence: "medium",
      });
      skipped++;
    } else {
      skipped++;
    }
  }

  // 2. Auto-map Swiss standard VAT codes
  const existingVatCodes = await prisma.vatCodeMapping.findMany({
    where: { companyId },
    select: { internalRate: true, bananaVatCode: true },
  });

  const existingRateCodes = new Set(
    existingVatCodes.map((v) => `${v.internalRate}:${v.bananaVatCode ?? ""}`)
  );

  for (const [rateStr, mapping] of Object.entries(SWISS_VAT_MAP)) {
    const rate = parseFloat(rateStr);
    const key = `${rate}:${mapping.code}`;

    if (!existingRateCodes.has(key)) {
      // Check if there's already an entry for this rate without banana code
      const existing = await prisma.vatCodeMapping.findFirst({
        where: { companyId, internalRate: rate, bananaVatCode: null },
      });

      if (existing) {
        await prisma.vatCodeMapping.update({
          where: { id: existing.id },
          data: {
            bananaVatCode: mapping.code,
            bananaVatLabel: mapping.label,
            mappingStatus: "mapped",
          },
        });
      } else {
        // Check if this rate+code combo already exists
        const alreadyExists = await prisma.vatCodeMapping.findFirst({
          where: { companyId, internalRate: rate, bananaVatCode: mapping.code },
        });

        if (!alreadyExists) {
          await prisma.vatCodeMapping.create({
            data: {
              companyId,
              internalRate: rate,
              internalLabel: rate === 0 ? "Steuerfrei 0%" : `Normalsatz ${rate}%`,
              bananaVatCode: mapping.code,
              bananaVatLabel: mapping.label,
              mappingStatus: "mapped",
              isDefault: true,
            },
          });
        }
      }
    }
  }

  return { mapped, skipped, suggestions };
}
