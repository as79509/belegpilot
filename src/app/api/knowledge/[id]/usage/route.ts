import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

/**
 * Wirkungsanalyse eines Knowledge Items:
 * - timesReferenced: Wie oft das Wissen in BookingSuggestion.reasoning.sources auftaucht
 * - lastUsed: Letzte Verwendung
 *
 * Die Quelle ist `Wissenseintrag "Title" berücksichtigt` in reasoning.sources[].detail
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { id } = await params;
    const item = await prisma.knowledgeItem.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Lade letzte Suggestions, filtere im JS, weil reasoning ein freies JSON-Feld ist
    const suggestions = await prisma.bookingSuggestion.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, reasoning: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const matchToken = `Wissenseintrag "${item.title}"`;
    let timesReferenced = 0;
    let lastUsed: Date | null = null;
    for (const s of suggestions) {
      const reasoning = s.reasoning as any;
      const sources = reasoning?.sources as any[] | undefined;
      if (!Array.isArray(sources)) continue;
      const hit = sources.some(
        (src) => src?.type === "knowledge" && typeof src?.detail === "string" && src.detail.includes(matchToken)
      );
      if (hit) {
        timesReferenced++;
        if (!lastUsed || s.createdAt > lastUsed) lastUsed = s.createdAt;
      }
    }

    // Editor-Name für Versions-Anzeige
    let editorName: string | null = null;
    if (item.lastEditedBy) {
      const editor = await prisma.user.findUnique({
        where: { id: item.lastEditedBy },
        select: { name: true },
      });
      editorName = editor?.name || null;
    }

    return NextResponse.json({
      timesReferenced,
      lastUsed,
      version: item.version,
      lastEditedBy: editorName,
      updatedAt: item.updatedAt,
    });
  } catch (error: any) {
    console.error("[knowledge usage]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
