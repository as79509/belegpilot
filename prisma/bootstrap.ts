import { ensureDatabase, prisma } from "../src/lib/db";

async function main() {
  await ensureDatabase();
  await prisma.$disconnect();
  console.log("SQLite Datenbank initialisiert.");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
