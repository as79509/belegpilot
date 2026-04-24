import { ensureDatabase, prisma } from "@/lib/db";
import { saveTextFixture } from "@/lib/storage";
import { buildExternalReference } from "@/lib/utils";

export async function seedDemoData() {
  await ensureDatabase();
  const existing = await prisma.client.findFirst({
    where: { shortName: "demo" },
  });

  if (existing) {
    return existing;
  }

  const client = await prisma.client.create({
    data: {
      name: "Demo Treuhand AG",
      shortName: "demo",
      companyName: "Demo Treuhand AG",
      currency: "CHF",
      defaultCreditAccount: "2000",
      defaultExpenseAccount: "4200",
      externalReferencePrefix: "DEMO",
      bookingMethodNote: "Kreditorisch mit Banana Import",
      chartOfAccountsRawText:
        "1000 Kasse\n1020 Bank\n2000 Kreditoren\n1171 Vorsteuer\n4200 Bueromaterial\n6100 Fahrzeugkosten",
      accounts: {
        create: [
          { accountNo: "1000", name: "Kasse", kind: "asset" },
          { accountNo: "1020", name: "Bank", kind: "asset" },
          { accountNo: "2000", name: "Kreditoren", kind: "creditor" },
          { accountNo: "1171", name: "Vorsteuer", kind: "tax" },
          { accountNo: "4200", name: "Bueromaterial", kind: "expense" },
          { accountNo: "6100", name: "Fahrzeugkosten", kind: "expense" },
        ],
      },
    },
  });

  const storedPath = await saveTextFixture({
    relativeName: `demo/${client.id}-demo-beleg.txt`,
    content: "Demo Beleg fuer BelegPilot Lite",
  });

  await prisma.document.create({
    data: {
      clientId: client.id,
      originalFilename: "demo-beleg.txt",
      storedPath,
      mimeType: "text/plain",
      status: "geprueft",
      supplierName: "Papeterie Muster",
      documentDate: new Date(),
      invoiceNumber: "R-2026-001",
      currency: "CHF",
      grossAmount: 48.2,
      description: "Papeterie und Bueromaterial",
      suggestedExpenseAccountNo: "4200",
      confirmedExpenseAccountNo: "4200",
      creditAccountNo: "2000",
      externalReference: buildExternalReference(client.externalReferencePrefix, "demo0001"),
      aiReasoningShort: "Demo Datensatz fuer den ersten Export.",
      aiRawJson: JSON.stringify({ source: "demo" }),
    },
  });

  return client;
}
