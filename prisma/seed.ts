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
      aiModel: "claude-haiku-4-5-20251001",
      aiOcrModel: "claude-haiku-4-5-20251001",
      aiTimeoutMs: 45000,
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
