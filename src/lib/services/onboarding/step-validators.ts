import { prisma } from "@/lib/db";

export interface StepValidation {
  complete: boolean;
  filledFields: string[];
  missingFields: string[];
  optionalMissing: string[];
  completionRate: number;
}

export async function validateStep1(companyId: string): Promise<StepValidation> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      name: true,
      legalName: true,
      industry: true,
      vatNumber: true,
      uid: true,
      legalForm: true,
      subIndustry: true,
      employeeCount: true,
      website: true,
      phone: true,
      email: true,
      businessModel: true,
      address: true,
    },
  });

  const requiredFields = ["name", "legalName", "industry"];
  const hasVatOrUid = !!(company.vatNumber || company.uid);
  const optionalFields = [
    "legalForm", "subIndustry", "employeeCount", "website",
    "phone", "email", "businessModel", "address",
  ];

  const filled: string[] = [];
  const missing: string[] = [];
  const optionalMissing: string[] = [];

  for (const f of requiredFields) {
    if ((company as any)[f]) filled.push(f);
    else missing.push(f);
  }

  if (hasVatOrUid) filled.push("vatNumber/uid");
  else missing.push("vatNumber/uid");

  for (const f of optionalFields) {
    if ((company as any)[f]) filled.push(f);
    else optionalMissing.push(f);
  }

  const totalFields = requiredFields.length + 1 + optionalFields.length;
  const completionRate = filled.length / totalFields;
  const complete = missing.length === 0;

  return { complete, filledFields: filled, missingFields: missing, optionalMissing, completionRate };
}

export async function validateStep2(companyId: string): Promise<StepValidation> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      vatLiable: true,
      vatMethod: true,
      vatInterval: true,
      chartOfAccounts: true,
      costCentersEnabled: true,
      fiscalYearStart: true,
    },
  });

  const accountCount = await prisma.account.count({ where: { companyId, isActive: true } });
  const bankAccountCount = await prisma.bankAccount.count({ where: { companyId, isActive: true } });

  const filled: string[] = [];
  const missing: string[] = [];
  const optionalMissing: string[] = [];

  // Required: vatLiable is always set (default true), so check chart
  filled.push("vatLiable");
  if (accountCount >= 10 || company.chartOfAccounts) {
    filled.push("chartOfAccounts");
  } else {
    missing.push("chartOfAccounts");
  }

  // Optional
  if (company.vatMethod) filled.push("vatMethod"); else optionalMissing.push("vatMethod");
  if (company.vatInterval) filled.push("vatInterval"); else optionalMissing.push("vatInterval");
  if (company.fiscalYearStart != null) filled.push("fiscalYearStart"); else optionalMissing.push("fiscalYearStart");
  if (bankAccountCount > 0) filled.push("bankAccounts"); else optionalMissing.push("bankAccounts");
  if (company.costCentersEnabled) filled.push("costCentersEnabled");

  const totalFields = 2 + 5; // required + optional
  const completionRate = filled.length / totalFields;
  const complete = missing.length === 0;

  return {
    complete,
    filledFields: filled,
    missingFields: missing,
    optionalMissing,
    completionRate,
    // Attach counts for UI
    ...(({ accountCount, bankAccountCount }) as any),
  };
}
