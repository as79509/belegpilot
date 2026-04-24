import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { ensureDatabase, prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { saveIncomingFile } from "@/lib/storage";
import { buildExternalReference } from "@/lib/utils";

function isSupportedDocument(file: File) {
  return (
    ["image/jpeg", "image/png", "application/pdf"].includes(file.type) ||
    /\.(jpg|jpeg|png|pdf)$/i.test(file.name)
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientId = String(formData.get("clientId") || "");
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!clientId) {
    return NextResponse.json({ error: "Bitte zuerst einen Mandanten wählen." }, { status: 400 });
  }

  if (!files.length) {
    return NextResponse.json({ error: "Bitte mindestens eine Datei auswählen." }, { status: 400 });
  }

  await ensureDatabase();

  const [client, settings] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    getAppSettings(),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Mandant wurde nicht gefunden." }, { status: 404 });
  }

  const createdDocuments: Array<{ id: string }> = [];

  for (const file of files) {
    if (!isSupportedDocument(file)) {
      return NextResponse.json({ error: "Nur JPG, PNG und PDF sind erlaubt." }, { status: 400 });
    }

    const documentId = randomUUID().replace(/-/g, "");
    const saved = await saveIncomingFile({
      file,
      clientId,
      documentId,
    });

    const prefix =
      client.externalReferencePrefix || settings.globalExternalReferencePrefix || client.shortName.toUpperCase();

    const document = await prisma.document.create({
      data: {
        id: documentId,
        clientId,
        originalFilename: saved.originalFilename,
        storedPath: saved.storedPath,
        mimeType: saved.mimeType,
        status: "neu",
        currency: client.currency,
        creditAccountNo:
          client.defaultCreditAccount || settings.exportDefaultCreditAccount || client.defaultCreditAccount,
        externalReference: buildExternalReference(prefix, documentId),
      },
      select: { id: true },
    });

    createdDocuments.push(document);
  }

  return NextResponse.json({ documents: createdDocuments });
}
