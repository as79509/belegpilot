import { NextResponse } from "next/server";

import { callAiJson, hasUsableAiConfig, useAnthropicSdk } from "@/lib/ai";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    aiBaseUrl?: string;
    aiApiKey?: string;
    aiModel?: string;
    aiTimeoutMs?: string;
  };

  const settings = {
    aiBaseUrl: payload.aiBaseUrl || null,
    aiApiKey: payload.aiApiKey || null,
    aiModel: payload.aiModel || null,
    aiTimeoutMs: Number.parseInt(payload.aiTimeoutMs || "45000", 10),
  };

  if (!hasUsableAiConfig(settings)) {
    const anthropic = useAnthropicSdk(settings);
    const hint = anthropic
      ? "Bitte API Key und Modell hinterlegen."
      : "Bitte Base URL, API Key und Modell hinterlegen.";
    return NextResponse.json({ error: hint }, { status: 400 });
  }

  try {
    await callAiJson<{ ok: boolean }>({
      settings,
      content: [
        {
          type: "text",
          text: 'Antworte mit dem JSON {"ok":true}.',
        },
      ],
    });

    return NextResponse.json({ message: "AI Verbindung erfolgreich getestet." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `AI Verbindung konnte nicht aufgebaut werden: ${message}` },
      { status: 400 },
    );
  }
}
