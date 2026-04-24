import { ensureDatabase, prisma } from "../src/lib/db";

async function main() {
  await ensureDatabase();
  await prisma.appSetting.upsert({
    where: { id: "app" },
    update: {},
    create: {
      id: "app",
      appName: "BelegPilot Lite",
      defaultCurrency: "CHF",
      globalExternalReferencePrefix: "BPL",
      defaultDateBehavior: "document_first",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
