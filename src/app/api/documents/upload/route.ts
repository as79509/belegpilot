import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { SupabaseStorageService } from "@/lib/services/storage/supabase-storage";
import { generateDocumentNumber } from "@/lib/services/document-number";
import { dispatchDocumentProcessing } from "@/lib/services/documents/document-processing-dispatch";
import { rateLimit } from "@/lib/rate-limit";
import { createHash } from "crypto";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function getUploadErrorMessage(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("fetch failed")) {
    return "Verarbeitung konnte lokal nicht gestartet werden. Bitte prüfen Sie den Verarbeitungsdienst.";
  }

  if (
    normalized.includes("document_number") ||
    normalized.includes("unique constraint") ||
    normalized.includes("p2002")
  ) {
    return "Beleg konnte lokal nicht gespeichert werden. Bitte erneut versuchen.";
  }

  if (
    normalized.includes("storage") ||
    normalized.includes("bucket") ||
    normalized.includes("invalid key") ||
    normalized.includes("invalid path")
  ) {
    return "Datei konnte lokal nicht gespeichert werden. Bitte prüfen Sie den Speicherpfad.";
  }

  return "Upload fehlgeschlagen. Bitte erneut versuchen.";
}

function isDocumentNumberConflict(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  return (
    message.toLowerCase().includes("document_number") ||
    message.toLowerCase().includes("unique constraint") ||
    message.toLowerCase().includes("p2002")
  );
}

async function createDocumentWithRetry(companyId: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const documentNumber = await generateDocumentNumber(companyId);
      return await prisma.document.create({
        data: {
          companyId,
          documentNumber,
          status: "uploaded",
          documentType: "other",
        },
      });
    } catch (error) {
      if (!isDocumentNumberConflict(error)) {
        throw error;
      }

      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Beleg konnte lokal nicht gespeichert werden");
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "documents:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const { session, companyId } = ctx;

    const { allowed } = rateLimit(`upload:${session.user.id}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "Keine Dateien ausgewählt" },
        { status: 400 }
      );
    }

    const storage = new SupabaseStorageService();
    const results: Array<{
      documentId: string;
      fileName: string;
      status: "created" | "duplicate" | "error";
      error?: string;
      existingDocumentId?: string;
    }> = [];

    for (const file of files) {
      try {
        if (!ALLOWED_TYPES.includes(file.type)) {
          results.push({
            documentId: "",
            fileName: file.name,
            status: "error",
            error: `Ungültiger Dateityp: ${file.type}`,
          });
          continue;
        }

        if (file.size > MAX_SIZE) {
          results.push({
            documentId: "",
            fileName: file.name,
            status: "error",
            error: "Datei zu gross (max. 20 MB)",
          });
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileHash = createHash("sha256").update(buffer).digest("hex");

        const existing = await prisma.documentFile.findFirst({
          where: { fileHash },
          include: { document: { select: { id: true, companyId: true } } },
        });

        if (existing && existing.document.companyId === companyId) {
          results.push({
            documentId: existing.document.id,
            fileName: file.name,
            status: "duplicate",
            existingDocumentId: existing.document.id,
          });
          continue;
        }

        const storagePath = await storage.store(
          file.name,
          buffer,
          file.type,
          companyId
        );
        const now = new Date();

        const document = await createDocumentWithRetry(companyId);

        await prisma.documentFile.create({
          data: {
            documentId: document.id,
            filePath: storagePath,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            fileHash,
          },
        });

        await prisma.processingStep.create({
          data: {
            documentId: document.id,
            stepName: "upload",
            status: "completed",
            startedAt: now,
            completedAt: new Date(),
            durationMs: Date.now() - now.getTime(),
          },
        });

        const dispatchResult = await dispatchDocumentProcessing({
          companyId,
          documentId: document.id,
          source: "upload",
        });
        if (!dispatchResult.ok) {
          results.push({
            documentId: document.id,
            fileName: file.name,
            status: "error",
            error: getUploadErrorMessage(dispatchResult.error),
          });
          continue;
        }

        results.push({
          documentId: document.id,
          fileName: file.name,
          status: "created",
        });
      } catch (fileError: any) {
        console.error(`[Upload] Failed for ${file.name}:`, fileError);
        results.push({
          documentId: "",
          fileName: file.name,
          status: "error",
          error: getUploadErrorMessage(fileError),
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("[Upload] Route error:", error);
    return NextResponse.json(
      { error: getUploadErrorMessage(error) },
      { status: 500 }
    );
  }
}
