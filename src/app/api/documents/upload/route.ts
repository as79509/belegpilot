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
        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) {
          results.push({
            documentId: "",
            fileName: file.name,
            status: "error",
            error: `Ungültiger Dateityp: ${file.type}`,
          });
          continue;
        }

        // Validate size
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

        // Compute SHA-256 hash
        const fileHash = createHash("sha256").update(buffer).digest("hex");

        // Check for duplicate
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

        // Upload to Supabase Storage
        const storagePath = await storage.store(
          file.name,
          buffer,
          file.type,
          companyId
        );
        const now = new Date();

        // Create Document + DocumentFile
        const documentNumber = await generateDocumentNumber(companyId);
        const document = await prisma.document.create({
          data: {
            companyId,
            documentNumber,
            status: "uploaded",
            documentType: "other",
          },
        });

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

        // Log processing step
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

        // Trigger Inngest processing (non-blocking — don't fail upload if Inngest is down)
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
              error: dispatchResult.error,
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
          error: fileError.message || "Unbekannter Fehler",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("[Upload] Route error:", error);
    return NextResponse.json(
      { error: error.message || "Upload fehlgeschlagen" },
      { status: 500 }
    );
  }
}
