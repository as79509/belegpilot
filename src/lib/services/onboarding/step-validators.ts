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
      name: true, legalName: true, legalForm: true, uid: true,
      vatNumber: true, industry: true, subIndustry: true,
      address: true, employeeCount: true, phone: true, email: true,
      website: true, businessModel: true,
    },
  });

  const required = ["name", "legalName", "industry"];
  const needsOneOf = ["vatNumber", "uid"];
  const optional = ["legalForm", "subIndustry", "address", "employeeCount", "phone", "email", "website", "businessModel"];

  const filled = Object.entries(company)
    .filter(([, v]) => v != null && v !== "")
    .map(([k]) => k);
  const missingRequired = required.filter((f) => !filled.includes(f));
  const hasIdentifier = needsOneOf.some((f) => filled.includes(f));
  if (!hasIdentifier) missingRequired.push("vatNumber oder UID");

  const optionalMissing = optional.filter((f) => !filled.includes(f));
  const totalFields = required.length + 1 + optional.length;

  return {
    complete: missingRequired.length === 0,
    filledFields: filled,
    missingFields: missingRequired,
    optionalMissing,
    completionRate: Math.min(1, filled.length / totalFields),
  };
}

export async function validateStep2(companyId: string): Promise<StepValidation & { accountCount: number; bankCount: number }> {
  const [company, accountCount, bankCount] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        vatLiable: true, vatMethod: true, vatInterval: true,
        chartOfAccounts: true, costCentersEnabled: true,
        projectsEnabled: true, fiscalYearStart: true,
      },
    }),
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.bankAccount.count({ where: { companyId } }),
  ]);

  const filled: string[] = [];
  const missing: string[] = [];
  const optionalMissing: string[] = [];

  filled.push("vatLiable");
  if (company.vatLiable && !company.vatMethod) missing.push("vatMethod");
  else if (company.vatMethod) filled.push("vatMethod");

  if (accountCount >= 10) filled.push("kontenplan");
  else missing.push("kontenplan (mindestens 10 Konten)");

  if (company.vatInterval) filled.push("vatInterval"); else optionalMissing.push("vatInterval");
  if (company.fiscalYearStart) filled.push("fiscalYearStart"); else optionalMissing.push("fiscalYearStart");
  if (bankCount > 0) filled.push("bankkonten"); else optionalMissing.push("bankkonten");

  const totalFields = filled.length + missing.length + optionalMissing.length;

  return {
    complete: missing.length === 0,
    filledFields: filled,
    missingFields: missing,
    optionalMissing,
    completionRate: Math.min(1, filled.length / Math.max(totalFields, 1)),
    accountCount,
    bankCount,
  };
}
