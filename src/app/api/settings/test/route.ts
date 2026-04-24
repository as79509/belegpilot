import { NextResponse } from "next/server";

import { callAiJson, hasUsableAiConfig } from "@/lib/ai";

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
    return NextResponse.json({ error: "Bitte Base URL, API Key und Modell hinterlegen." }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: "AI Verbindung konnte nicht aufgebaut werden." }, { status: 400 });
  }
}
