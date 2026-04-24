import { readStoredFile } from "@/lib/storage";
import type { ExtractedDocumentResult, LiteSettings, StructuredAccount } from "@/lib/types";
import { isImageMimeType, isPdfMimeType, takeFirstLine } from "@/lib/utils";

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function buildChatEndpoint(baseUrl: string) {
  return /\/(chat\/completions|responses)$/.test(baseUrl)
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function extractJsonCandidate(value: unknown) {
  if (typeof value === "string") {
    const first = value.indexOf("{");
    const last = value.lastIndexOf("}");
    return first >= 0 && last >= 0 ? value.slice(first, last + 1) : value;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "text" in entry) {
          return String((entry as { text?: string }).text ?? "");
        }

        return "";
      })
      .join("\n");

    return extractJsonCandidate(joined);
  }

  return "";
}

export function hasUsableAiConfig(settings: LiteSettings) {
  return Boolean(settings.aiBaseUrl && settings.aiApiKey && settings.aiModel);
}

export async function callAiJson<T>(input: {
  settings: LiteSettings;
  content: ContentPart[];
}) {
  if (!hasUsableAiConfig(input.settings)) {
    throw new Error("AI nicht konfiguriert");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.settings.aiTimeoutMs ?? 45000);

  try {
    const response = await fetch(buildChatEndpoint(input.settings.aiBaseUrl!), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.settings.aiApiKey}`,
      },
      body: JSON.stringify({
        model: input.settings.aiModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Du bist ein deutscher Buchhaltungsassistent fuer Treuhaender. " +
              "Antworte ausschliesslich als JSON. Keine Markdown-Ausgabe.",
          },
          {
            role: "user",
            content: input.content,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Anfrage fehlgeschlagen (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const choiceContent = payload.choices?.[0]?.message?.content;
    const outputContent = payload.output?.flatMap((entry) => entry.content ?? []);
    const raw = extractJsonCandidate(choiceContent || outputContent);

    return JSON.parse(raw) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function inferFallbackSupplier(filename: string) {
  const cleaned = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  return takeFirstLine(cleaned) || "Unbekannt";
}

export function buildFallbackDocumentResult(input: {
  filename: string;
  defaultCurrency: string;
  defaultExpenseAccount: string;
}) {
  return {
    supplierName: inferFallbackSupplier(input.filename),
    currency: input.defaultCurrency,
    suggestedExpenseAccount: input.defaultExpenseAccount,
    shortDescription: "Beleg ohne AI erkannt",
    reasoningShort: "Fallback auf Standardkonto, weil keine AI-Konfiguration verfuegbar ist.",
    confidenceLabel: "niedrig" as const,
  };
}

async function buildVisualContent(storedPath: string, mimeType: string) {
  const buffer = await readStoredFile(storedPath);

  if (isImageMimeType(mimeType)) {
    return [
      {
        type: "image_url" as const,
        image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` },
      },
    ];
  }

  if (isPdfMimeType(mimeType)) {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(buffer, { scale: 2.2 });
    const pages: ContentPart[] = [];
    const maxPages = Math.min(document.length, 5);

    for (let index = 1; index <= maxPages; index += 1) {
      const page = await document.getPage(index);
      pages.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${page.toString("base64")}` },
      });
    }

    return pages;
  }

  return [];
}

function normalizeSuggestedAccount(
  suggested: string | null | undefined,
  accounts: StructuredAccount[],
  fallbackAccount: string,
) {
  if (!suggested) {
    return fallbackAccount;
  }

  const direct = accounts.find((account) => account.accountNo === suggested);
  if (direct) {
    return direct.accountNo;
  }

  const trimmed = suggested.trim();
  const startsWith = accounts.find((account) => trimmed.startsWith(account.accountNo));
  return startsWith?.accountNo ?? fallbackAccount;
}

export async function extractDocumentData(input: {
  storedPath: string;
  mimeType: string;
  filename: string;
  settings: LiteSettings;
  client: {
    currency: string;
    defaultExpenseAccount: string;
    chartOfAccountsRawText?: string | null;
  };
  accounts: StructuredAccount[];
}) {
  const fallback = buildFallbackDocumentResult({
    filename: input.filename,
    defaultCurrency: input.client.currency || input.settings.defaultCurrency || "CHF",
    defaultExpenseAccount: input.client.defaultExpenseAccount,
  });

  if (!hasUsableAiConfig(input.settings)) {
    return {
      ...fallback,
      rawJson: JSON.stringify(fallback, null, 2),
    };
  }

  try {
    const accountExcerpt = input.accounts
      .slice(0, 80)
      .map((account) => `${account.accountNo} ${account.name}`)
      .join("\n");

    const content: ContentPart[] = [
      {
        type: "text",
        text:
          "Lies den Beleg fuer einen Treuhaender aus und antworte ausschliesslich als JSON. " +
          'Format: {"supplierName":"","documentDate":"YYYY-MM-DD|null","invoiceDate":"YYYY-MM-DD|null",' +
          '"dueDate":"YYYY-MM-DD|null","invoiceNumber":"","currency":"CHF","grossAmount":123.45,' +
          '"shortDescription":"","suggestedExpenseAccount":"4200","reasoningShort":"","confidenceLabel":"niedrig|mittel|hoch",' +
          '"taxHint":""}. Verwende genau ein Aufwandskonto.',
      },
      {
        type: "text",
        text:
          `Mandantenwaehrung: ${input.client.currency}\n` +
          `Fallback Aufwandskonto: ${input.client.defaultExpenseAccount}\n` +
          `Verfuegbare Konten:\n${accountExcerpt}`,
      },
      ...((await buildVisualContent(input.storedPath, input.mimeType)) as ContentPart[]),
    ];

    const result = await callAiJson<ExtractedDocumentResult>({
      settings: input.settings,
      content,
    });

    const normalized: ExtractedDocumentResult = {
      supplierName: result.supplierName || fallback.supplierName,
      documentDate: result.documentDate || null,
      invoiceDate: result.invoiceDate || null,
      dueDate: result.dueDate || null,
      invoiceNumber: result.invoiceNumber || null,
      currency: result.currency || input.client.currency || input.settings.defaultCurrency || "CHF",
      grossAmount:
        typeof result.grossAmount === "number" && Number.isFinite(result.grossAmount)
          ? result.grossAmount
          : null,
      shortDescription: result.shortDescription || fallback.shortDescription,
      suggestedExpenseAccount: normalizeSuggestedAccount(
        result.suggestedExpenseAccount,
        input.accounts,
        input.client.defaultExpenseAccount,
      ),
      reasoningShort:
        result.reasoningShort ||
        "Kontierung ueber Fallbacklogik, weil der Vorschlag nicht eindeutig war.",
      confidenceLabel: result.confidenceLabel || "mittel",
      taxHint: result.taxHint || null,
    };

    return {
      ...normalized,
      rawJson: JSON.stringify(normalized, null, 2),
    };
  } catch {
    return {
      ...fallback,
      rawJson: JSON.stringify(fallback, null, 2),
    };
  }
}
