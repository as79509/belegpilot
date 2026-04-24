import Anthropic from "@anthropic-ai/sdk";

import { readStoredFile } from "@/lib/storage";
import type { ExtractedDocumentResult, LiteSettings, StructuredAccount } from "@/lib/types";
import { isImageMimeType, isPdfMimeType, takeFirstLine } from "@/lib/utils";

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

type AnthropicMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: AnthropicMediaType; data: string } };

function normalizeMediaType(raw: string): AnthropicMediaType {
  const lower = raw.toLowerCase();
  if (lower === "image/jpeg" || lower === "image/jpg") return "image/jpeg";
  if (lower === "image/png") return "image/png";
  if (lower === "image/gif") return "image/gif";
  if (lower === "image/webp") return "image/webp";
  // Fallback: PNG akzeptiert Anthropic immer
  return "image/png";
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

export class AiCallError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiCallError";
  }
}

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

/** True when aiBaseUrl is empty, unset, or explicitly mentions Anthropic. */
export function useAnthropicSdk(settings: LiteSettings) {
  const base = (settings.aiBaseUrl || "").trim().toLowerCase();
  return base === "" || base.includes("anthropic");
}

export function hasUsableAiConfig(settings: LiteSettings) {
  // Anthropic-Pfad: braucht nur apiKey + model (BaseURL optional/leer)
  if (useAnthropicSdk(settings)) {
    return Boolean(settings.aiApiKey && settings.aiModel);
  }
  // OpenAI-Compatible-Pfad: braucht BaseURL + apiKey + model
  return Boolean(settings.aiBaseUrl && settings.aiApiKey && settings.aiModel);
}

/** Convert OpenAI-style ContentPart[] to Anthropic content blocks. */
function toAnthropicContent(parts: ContentPart[]): AnthropicContent[] {
  return parts.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text };
    }
    // image_url: extract base64 + media_type from data URL
    const url = part.image_url.url;
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return { type: "text" as const, text: "[unbekanntes Bild]" };
    }
    return {
      type: "image" as const,
      source: { type: "base64" as const, media_type: normalizeMediaType(match[1]), data: match[2] },
    };
  });
}

const SYSTEM_PROMPT =
  "Du bist ein deutscher Buchhaltungsassistent fuer Treuhaender. " +
  "Antworte ausschliesslich als JSON. Keine Markdown-Ausgabe.";

async function callAnthropic<T>(input: { settings: LiteSettings; content: ContentPart[] }): Promise<T> {
  const client = new Anthropic({ apiKey: input.settings.aiApiKey! });
  const timeoutMs = input.settings.aiTimeoutMs ?? 45000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.messages.create(
      {
        model: input.settings.aiModel!,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: toAnthropicContent(input.content),
          },
        ],
      },
      { signal: controller.signal },
    );

    // Collect text from content blocks
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const raw = extractJsonCandidate(text);
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiCallError(`AI-Call Timeout nach ${timeoutMs} ms`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiCallError(`Anthropic-API-Fehler (${error.status}): ${error.message}`, error);
    }
    if (error instanceof SyntaxError) {
      throw new AiCallError(`AI-Antwort ist kein valides JSON: ${error.message}`);
    }
    throw new AiCallError(
      `AI-Call fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAiCompatible<T>(input: { settings: LiteSettings; content: ContentPart[] }): Promise<T> {
  const timeoutMs = input.settings.aiTimeoutMs ?? 45000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input.content },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiCallError(`AI-Anfrage fehlgeschlagen (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const choiceContent = payload.choices?.[0]?.message?.content;
    const outputContent = payload.output?.flatMap((entry) => entry.content ?? []);
    const raw = extractJsonCandidate(choiceContent || outputContent);

    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof AiCallError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiCallError(`AI-Call Timeout nach ${timeoutMs} ms`);
    }
    if (error instanceof SyntaxError) {
      throw new AiCallError(`AI-Antwort ist kein valides JSON: ${error.message}`);
    }
    throw new AiCallError(
      `AI-Call fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function callAiJson<T>(input: { settings: LiteSettings; content: ContentPart[] }): Promise<T> {
  if (!hasUsableAiConfig(input.settings)) {
    throw new AiConfigError("AI nicht konfiguriert");
  }
  if (useAnthropicSdk(input.settings)) {
    return callAnthropic<T>(input);
  }
  return callOpenAiCompatible<T>(input);
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

/**
 * Wenn Config fehlt: Fallback + Flag `aiConfigured=false`.
 * Wenn AI-Call scheitert: AiCallError wird nach oben propagiert damit die Route
 * HTTP 502 mit klarer Fehlermeldung zurueckgeben kann.
 */
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
    throw new AiConfigError(
      "AI nicht konfiguriert — bitte in Einstellungen aiApiKey und aiModel setzen",
    );
  }

  const accountExcerpt = input.accounts
    .slice(0, 80)
    .map((account) => `${account.accountNo} ${account.name}`)
    .join("\n");

  const visual = await buildVisualContent(input.storedPath, input.mimeType);

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
    ...visual,
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
    rawJson: JSON.stringify(result, null, 2),
  };
}
