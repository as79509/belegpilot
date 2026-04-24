import { NextResponse } from "next/server";

import { AiCallError, AiConfigError, extractDocumentData } from "@/lib/ai";
import { ensureDatabase, prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { parseDateInput } from "@/lib/utils";

function log(step: string, data?: Record<string, unknown>) {
  console.log(`[process] ${step}`, data ? JSON.stringify(data) : "");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  log("start", { documentId: id });

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
    log("document-not-found", { documentId: id });
    return NextResponse.json({ error: "Beleg wurde nicht gefunden." }, { status: 404 });
  }

  log("document-loaded", {
    documentId: id,
    mimeType: document.mimeType,
    filename: document.originalFilename,
    clientId: document.clientId,
    accountCount: document.client.accounts.length,
  });

  const settings = await getAppSettings();
  log("settings-loaded", {
    hasApiKey: Boolean(settings.aiApiKey),
    aiBaseUrl: settings.aiBaseUrl || "(leer → Anthropic SDK)",
    aiModel: settings.aiModel,
    aiTimeoutMs: settings.aiTimeoutMs,
  });

  try {
    log("extract-start");
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
    log("extract-success", {
      supplierName: result.supplierName,
      grossAmount: result.grossAmount,
      confidence: result.confidenceLabel,
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
        suggestedExpenseAccountNo:
          result.suggestedExpenseAccount ?? document.client.defaultExpenseAccount,
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

    log("document-updated", { documentId: id, status: updated.status });
    return NextResponse.json({ document: updated });
  } catch (error) {
    log("extract-failed", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    // Fehler in aiReasoningShort persistieren — kein stiller Fallback mehr
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.document
      .update({
        where: { id },
        data: {
          aiReasoningShort: `AI-Fehler: ${errorMessage}`,
          aiConfidenceLabel: "niedrig",
        },
      })
      .catch(() => {
        /* Best effort — falls DB-Update scheitert, nicht die Haupt-Antwort blockieren */
      });

    if (error instanceof AiConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "ai_not_configured",
        },
        { status: 400 },
      );
    }

    if (error instanceof AiCallError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "ai_call_failed",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: `Verarbeitung fehlgeschlagen: ${errorMessage}`,
        code: "unknown_error",
      },
      { status: 500 },
    );
  }
}
