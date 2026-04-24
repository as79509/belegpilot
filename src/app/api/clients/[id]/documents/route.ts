import { NextResponse } from "next/server";

import { ensureDatabase, prisma } from "@/lib/db";
import { deleteStoredFile } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabase();

  const documents = await prisma.document.findMany({
    where: { clientId: id },
    select: { id: true, storedPath: true },
  });

  await Promise.all(documents.map((document) => deleteStoredFile(document.storedPath)));
  await prisma.document.deleteMany({ where: { clientId: id } });

  return NextResponse.json({ message: "Alle Belege des Mandanten wurden gelöscht." });
}
