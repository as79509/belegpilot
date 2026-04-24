import { NextResponse } from "next/server";

import { ensureDatabase, prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabase();
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return NextResponse.json({ error: "Datei wurde nicht gefunden." }, { status: 404 });
  }

  const buffer = await readStoredFile(document.storedPath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": document.mimeType,
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${document.originalFilename}"`,
    },
  });
}
