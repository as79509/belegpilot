import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppSettings, updateAppSettings } from "@/lib/settings";

const settingsSchema = z.object({
  appName: z.string().min(1),
  defaultCurrency: z.string().min(3).max(3),
  aiBaseUrl: z.string().optional(),
  aiApiKey: z.string().optional(),
  aiModel: z.string().optional(),
  aiOcrModel: z.string().optional(),
  aiTimeoutMs: z.string().optional(),
  exportDefaultCreditAccount: z.string().optional(),
  exportDefaultExpenseAccount: z.string().optional(),
  defaultDateBehavior: z.string().min(1),
  globalExternalReferencePrefix: z.string().min(1),
});

function emptyToNull(value?: string) {
  return value?.trim() ? value.trim() : null;
}

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  try {
    const payload = settingsSchema.parse(await request.json());
    const settings = await updateAppSettings({
      appName: payload.appName.trim(),
      defaultCurrency: payload.defaultCurrency.toUpperCase(),
      aiBaseUrl: emptyToNull(payload.aiBaseUrl),
      aiApiKey: emptyToNull(payload.aiApiKey),
      aiModel: emptyToNull(payload.aiModel),
      aiOcrModel: emptyToNull(payload.aiOcrModel),
      aiTimeoutMs: Number.parseInt(payload.aiTimeoutMs || "45000", 10),
      exportDefaultCreditAccount: emptyToNull(payload.exportDefaultCreditAccount),
      exportDefaultExpenseAccount: emptyToNull(payload.exportDefaultExpenseAccount),
      defaultDateBehavior: payload.defaultDateBehavior,
      globalExternalReferencePrefix: payload.globalExternalReferencePrefix.trim().toUpperCase(),
    });

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Einstellungen konnten nicht gespeichert werden." }, { status: 400 });
  }
}
