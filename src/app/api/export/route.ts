import { NextResponse } from "next/server";

import { buildBananaExport } from "@/lib/banana";
import { ensureDatabase, prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { parseDateInput, resolvePostingDate } from "@/lib/utils";

function withinRange(date: Date, from?: Date | null, to?: Date | null) {
  const startOk = from ? date >= from : true;
  const endOk = to ? date <= to : true;
  return startOk && endOk;
}

async function buildExportPreview(options: {
  clientId: string;
  from?: Date | null;
  to?: Date | null;
  onlyReviewed: boolean;
}) {
  await ensureDatabase();
  const [settings, client, documents] = await Promise.all([
    getAppSettings(),
    prisma.client.findUnique({ where: { id: options.clientId } }),
    prisma.document.findMany({
      where: { clientId: options.clientId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!client) {
    throw new Error("Mandant wurde nicht gefunden.");
  }

  const inRangeDocuments = documents.filter((document) => {
    const postingDate = resolvePostingDate({
      documentDate: document.documentDate,
      invoiceDate: document.invoiceDate,
      createdAt: document.createdAt,
      defaultDateBehavior: settings.defaultDateBehavior,
    });

    return withinRange(postingDate, options.from, options.to);
  });

  return {
    exportBundle: buildBananaExport({
      clientName: client.name,
      clientShortName: client.shortName,
      defaultDateBehavior: settings.defaultDateBehavior,
      documents: inRangeDocuments,
      onlyReviewed: options.onlyReviewed,
    }),
    documents: inRangeDocuments,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || "";
  const from = parseDateInput(searchParams.get("from"));
  const to = parseDateInput(searchParams.get("to"));
  const onlyReviewed = searchParams.get("onlyReviewed") === "1";

  if (!clientId) {
    return NextResponse.json({ error: "Bitte einen Mandanten wählen." }, { status: 400 });
  }

  try {
    const { exportBundle } = await buildExportPreview({
      clientId,
      from,
      to,
      onlyReviewed,
    });

    return NextResponse.json(exportBundle);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Exportvorschau konnte nicht erstellt werden." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    clientId?: string;
    from?: string;
    to?: string;
    onlyReviewed?: boolean;
    markAsExported?: boolean;
  };

  if (!payload.clientId) {
    return NextResponse.json({ error: "Bitte einen Mandanten wählen." }, { status: 400 });
  }

  try {
    const { exportBundle, documents } = await buildExportPreview({
      clientId: payload.clientId,
      from: parseDateInput(payload.from),
      to: parseDateInput(payload.to),
      onlyReviewed: Boolean(payload.onlyReviewed),
    });

    if (!exportBundle.count) {
      return NextResponse.json({ error: "Keine exportfähigen Belege im Zeitraum gefunden." }, { status: 400 });
    }

    if (payload.markAsExported) {
      const exportableIds = documents
        .filter((document) =>
          exportBundle.includedExternalReferences.includes(document.externalReference),
        )
        .map((document) => document.id);

      if (exportableIds.length) {
        await prisma.document.updateMany({
          where: { id: { in: exportableIds } },
          data: {
            status: "exportiert",
            exportedAt: new Date(),
          },
        });
      }
    }

    return new NextResponse(exportBundle.content, {
      headers: {
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportBundle.fileName}"`,
        "X-Export-Filename": exportBundle.fileName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export konnte nicht erstellt werden." },
      { status: 400 },
    );
  }
}
