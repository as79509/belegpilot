import { NextResponse } from "next/server";

import { extractDocumentData } from "@/lib/ai";
import { ensureDatabase, prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { parseDateInput } from "@/lib/utils";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabase();

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          accounts: {
            where: { isActive: true },
            orderBy: { accountNo: "asc" },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Beleg wurde nicht gefunden." }, { status: 404 });
  }

  const settings = await getAppSettings();
  const result = await extractDocumentData({
    storedPath: document.storedPath,
    mimeType: document.mimeType,
    filename: document.originalFilename,
    settings,
    client: {
      currency: document.client.currency,
      defaultExpenseAccount:
        document.client.defaultExpenseAccount ||
        settings.exportDefaultExpenseAccount ||
        document.client.defaultCreditAccount,
      chartOfAccountsRawText: document.client.chartOfAccountsRawText,
    },
    accounts: document.client.accounts.map((account) => ({
      accountNo: account.accountNo,
      name: account.name,
      kind: account.kind,
      isActive: account.isActive,
    })),
  });

  const updated = await prisma.document.update({
    where: { id },
    data: {
      supplierName: result.supplierName ?? document.supplierName,
      documentDate: parseDateInput(result.documentDate ?? undefined),
      invoiceDate: parseDateInput(result.invoiceDate ?? undefined),
      dueDate: parseDateInput(result.dueDate ?? undefined),
      invoiceNumber: result.invoiceNumber ?? null,
      currency: result.currency ?? document.client.currency,
      grossAmount: result.grossAmount ?? null,
      taxHint: result.taxHint ?? null,
      description: result.shortDescription ?? null,
      suggestedExpenseAccountNo: result.suggestedExpenseAccount ?? document.client.defaultExpenseAccount,
      creditAccountNo:
        document.creditAccountNo ||
        document.client.defaultCreditAccount ||
        settings.exportDefaultCreditAccount ||
        null,
      aiReasoningShort: result.reasoningShort ?? null,
      aiConfidenceLabel: result.confidenceLabel ?? null,
      aiRawJson: result.rawJson ?? null,
      status: document.status === "exportiert" ? "exportiert" : "gelesen",
    },
  });

  return NextResponse.json({ document: updated });
}
