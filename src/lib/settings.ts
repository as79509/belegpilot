import { ensureDatabase, prisma } from "@/lib/db";
import { useAnthropicSdk } from "@/lib/ai";
import type { LiteSettings } from "@/lib/types";

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const defaultSettingValues = {
  id: "app",
  appName: "BelegPilot Lite",
  defaultCurrency: "CHF",
  aiBaseUrl: process.env.AI_BASE_URL ?? null, // leer = nutze Anthropic-SDK
  aiApiKey: process.env.AI_API_KEY ?? null,
  aiModel: process.env.AI_MODEL ?? DEFAULT_CLAUDE_MODEL,
  aiOcrModel: process.env.AI_OCR_MODEL ?? DEFAULT_CLAUDE_MODEL,
  aiTimeoutMs: Number.parseInt(process.env.AI_TIMEOUT_MS ?? "45000", 10),
  exportDefaultCreditAccount: null,
  exportDefaultExpenseAccount: null,
  defaultDateBehavior: "document_first",
  globalExternalReferencePrefix: "BPL",
};

export async function getAppSettings() {
  await ensureDatabase();
  return prisma.appSetting.upsert({
    where: { id: "app" },
    update: {},
    create: defaultSettingValues,
  });
}

export async function updateAppSettings(data: LiteSettings) {
  await ensureDatabase();
  return prisma.appSetting.upsert({
    where: { id: "app" },
    update: {
      appName: data.appName,
      defaultCurrency: data.defaultCurrency,
      aiBaseUrl: data.aiBaseUrl,
      aiApiKey: data.aiApiKey,
      aiModel: data.aiModel,
      aiOcrModel: data.aiOcrModel,
      aiTimeoutMs: data.aiTimeoutMs ?? 45000,
      exportDefaultCreditAccount: data.exportDefaultCreditAccount,
      exportDefaultExpenseAccount: data.exportDefaultExpenseAccount,
      defaultDateBehavior: data.defaultDateBehavior ?? "document_first",
      globalExternalReferencePrefix: data.globalExternalReferencePrefix ?? "BPL",
    },
    create: {
      ...defaultSettingValues,
      ...data,
      id: "app",
      aiTimeoutMs: data.aiTimeoutMs ?? 45000,
      defaultDateBehavior: data.defaultDateBehavior ?? "document_first",
      globalExternalReferencePrefix: data.globalExternalReferencePrefix ?? "BPL",
    },
  });
}

export function hasAiConfiguration(settings: LiteSettings) {
  if (useAnthropicSdk(settings)) {
    return Boolean(settings.aiApiKey && settings.aiModel);
  }
  return Boolean(settings.aiBaseUrl && settings.aiApiKey && settings.aiModel);
}
