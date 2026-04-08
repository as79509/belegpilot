import { prisma } from "@/lib/db";

export async function checkEscalations(
  companyId: string,
  doc: Record<string, any>,
  supplier?: Record<string, any> | null
): Promise<string[]> {
  const rules = await prisma.escalationRule.findMany({
    where: { companyId, isActive: true },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });

  const reasons: string[] = [];

  for (const rule of rules) {
    let matches = false;

    switch (rule.condition) {
      case "new_supplier":
        matches = supplier ? supplier.isVerified === false : false;
        break;
      case "amount_above":
        matches = doc.grossAmount != null && rule.threshold != null && Number(doc.grossAmount) > rule.threshold;
        break;
      case "foreign_document":
        matches = !!doc.currency && !!company?.currency && doc.currency !== company.currency;
        break;
      case "missing_invoice_number":
        matches = !doc.invoiceNumber?.trim();
        break;
      case "vehicle_cost":
        const cat = (doc.expenseCategory || "").toLowerCase();
        matches = cat.includes("vehicle") || cat.includes("fahrzeug") || cat.includes("auto");
        break;
      case "asset_suspected":
        matches = doc.grossAmount != null && Number(doc.grossAmount) > (rule.threshold || 1000);
        break;
      case "mixed_vat":
        const rates = doc.vatRatesDetected as any[];
        matches = Array.isArray(rates) && rates.length > 1;
        break;
      case "manual_always":
        matches = true;
        break;
    }

    if (matches) {
      reasons.push(rule.name);
    }
  }

  return reasons;
}
