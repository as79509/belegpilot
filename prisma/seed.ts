import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default company
  const company = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "BelegPilot Demo",
      legalName: "BelegPilot Demo GmbH",
      vatNumber: "CHE-123.456.789",
      currency: "CHF",
      address: {
        street: "Bahnhofstrasse 1",
        zip: "8001",
        city: "Zürich",
        country: "CH",
      },
    },
  });

  // Create admin user (password: admin123)
  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@belegpilot.ch" },
    update: {},
    create: {
      companyId: company.id,
      email: "admin@belegpilot.ch",
      name: "Admin",
      passwordHash,
      role: UserRole.admin,
      isActive: true,
    },
  });

  // Create reviewer user (password: reviewer123)
  const reviewerHash = await bcrypt.hash("reviewer123", 12);
  await prisma.user.upsert({
    where: { email: "reviewer@belegpilot.ch" },
    update: {},
    create: {
      companyId: company.id,
      email: "reviewer@belegpilot.ch",
      name: "Reviewer",
      passwordHash: reviewerHash,
      role: UserRole.reviewer,
      isActive: true,
    },
  });

  console.log("Seed complete: company + 2 users created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
