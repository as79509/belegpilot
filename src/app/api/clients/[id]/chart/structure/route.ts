import { NextResponse } from "next/server";

import { structureChartOfAccounts } from "@/lib/chart-of-accounts";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const formData = await request.formData();
  const rawText = String(formData.get("rawText") || "");
  const file = formData.get("file");
  const settings = await getAppSettings();

  let appendedRawText = rawText;
  let pdfBuffer: Buffer | null = null;

  if (file instanceof File) {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "text/plain" || file.type === "text/csv" || /\.txt$|\.csv$/i.test(file.name)) {
      appendedRawText = [rawText, buffer.toString("utf8")].filter(Boolean).join("\n");
    } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      pdfBuffer = buffer;
      appendedRawText = [rawText, `PDF Upload: ${file.name}`].filter(Boolean).join("\n");
    } else {
      return NextResponse.json({ error: "Nur TXT, CSV oder PDF sind für den Kontenplan erlaubt." }, { status: 400 });
    }
  }

  if (!appendedRawText.trim() && !pdfBuffer) {
    return NextResponse.json({ error: "Bitte Rohtext oder eine Kontenplan-Datei angeben." }, { status: 400 });
  }

  const result = await structureChartOfAccounts({
    rawText: appendedRawText,
    pdfBuffer,
    settings,
  });

  await prisma.$transaction([
    prisma.client.update({
      where: { id },
      data: {
        chartOfAccountsRawText: appendedRawText,
      },
    }),
    prisma.account.deleteMany({ where: { clientId: id } }),
    prisma.account.createMany({
      data: result.accounts.map((account) => ({
        clientId: id,
        accountNo: account.accountNo,
        name: account.name,
        kind: account.kind ?? null,
        isActive: account.isActive,
      })),
    }),
  ]);

  return NextResponse.json({
    accounts: result.accounts,
    rawText: appendedRawText,
    usedAi: result.usedAi,
  });
}
