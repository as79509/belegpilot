import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const companyId = "00000000-0000-0000-0000-000000000001";
  const company2Id = "00000000-0000-0000-0000-000000000002";

  // Company 1: Demo AG
  await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId,
      name: "Demo AG",
      legalName: "Demo AG",
      vatNumber: "CHE-123.456.789 MWST",
      currency: "CHF",
      address: { street: "Bahnhofstrasse 1", zip: "8001", city: "Zürich", country: "CH" },
      settings: { aiMonthlyBudgetUsd: 50 },
    },
  });

  // Company 2: Müller GmbH
  await prisma.company.upsert({
    where: { id: company2Id },
    update: {},
    create: {
      id: company2Id,
      name: "Müller GmbH",
      legalName: "Müller Handels GmbH",
      vatNumber: "CHE-987.654.321 MWST",
      currency: "CHF",
      address: { street: "Hauptgasse 12", zip: "3011", city: "Bern", country: "CH" },
      settings: { aiMonthlyBudgetUsd: 30 },
    },
  });

  // Users
  const hash = await bcrypt.hash("demo2026", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@belegpilot.ch" },
    update: { passwordHash: hash },
    create: { companyId, email: "admin@belegpilot.ch", name: "Admin", passwordHash: hash, role: UserRole.admin, isActive: true },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@belegpilot.ch" },
    update: { passwordHash: hash },
    create: { companyId, email: "reviewer@belegpilot.ch", name: "Reviewer", passwordHash: hash, role: UserRole.reviewer, isActive: true },
  });

  const trustee = await prisma.user.upsert({
    where: { email: "trustee@belegpilot.ch" },
    update: { passwordHash: hash },
    create: { companyId: company2Id, email: "trustee@belegpilot.ch", name: "Treuhänder", passwordHash: hash, role: UserRole.trustee, isActive: true },
  });

  // UserCompany entries
  const ucEntries = [
    { userId: admin.id, companyId, role: UserRole.admin, isDefault: true },
    { userId: trustee.id, companyId, role: UserRole.reviewer, isDefault: false },
    { userId: trustee.id, companyId: company2Id, role: UserRole.admin, isDefault: true },
  ];

  for (const uc of ucEntries) {
    await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: uc.userId, companyId: uc.companyId } },
      update: { role: uc.role, isDefault: uc.isDefault },
      create: uc,
    });
  }

  // Suppliers (for Demo AG)
  const suppliers = [
    { name: "Swisscom", vat: "CHE-100.022.551 MWST", iban: "CH93 0076 2011 6238 5295 7", city: "Bern", category: "Telekommunikation", account: "6200" },
    { name: "GoMore", vat: null, iban: "DK50 0040 0440 1162 63", city: "Copenhagen", category: "Vehicle Rental", account: "6300" },
    { name: "Migros", vat: "CHE-105.805.898 MWST", iban: "CH35 0078 8000 0500 0845 8", city: "Zürich", category: "Büromaterial", account: "6500" },
    { name: "PostFinance", vat: "CHE-114.583.629 MWST", iban: "CH92 0900 0000 1530 5068 3", city: "Bern", category: "Bankgebühren", account: "6800" },
    { name: "Coop", vat: "CHE-106.004.989 MWST", iban: "CH72 0070 0110 0006 0379 7", city: "Basel", category: "Büromaterial", account: "6500" },
  ];

  for (const s of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { companyId, nameNormalized: s.name } });
    if (!existing) {
      await prisma.supplier.create({
        data: {
          companyId, nameNormalized: s.name, nameVariants: [s.name],
          vatNumber: s.vat, iban: s.iban, city: s.city,
          country: s.city === "Copenhagen" ? "DK" : "CH",
          defaultCategory: s.category, defaultAccountCode: s.account,
          isVerified: true, documentCount: 0,
        },
      });
    }
  }

  // Rules (for Demo AG)
  const ruleCount = await prisma.rule.count({ where: { companyId } });
  if (ruleCount === 0) {
    await prisma.rule.createMany({
      data: [
        {
          companyId, name: "Swisscom → Telekommunikation", ruleType: "supplier_default",
          conditions: [{ field: "supplierName", operator: "contains", value: "Swisscom" }],
          actions: [{ type: "set_category", value: "Telekommunikation" }, { type: "set_account_code", value: "6200" }],
          priority: 10, isActive: true,
        },
        {
          companyId, name: "GoMore → Vehicle Rental", ruleType: "supplier_default",
          conditions: [{ field: "supplierName", operator: "contains", value: "GoMore" }],
          actions: [{ type: "set_category", value: "Vehicle Rental" }, { type: "set_account_code", value: "6300" }],
          priority: 10, isActive: true,
        },
        {
          companyId, name: "Kleinbeträge Auto-Genehmigung", ruleType: "auto_approve",
          conditions: [{ field: "grossAmount", operator: "less_than", value: "50" }],
          actions: [{ type: "auto_approve" }],
          priority: 5, isActive: true,
        },
      ],
    });
  }

  console.log("Seed complete: 2 companies, 3 users, 3 user-company mappings, 5 suppliers, 3 rules");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
