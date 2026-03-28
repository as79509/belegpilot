import { inngest } from "./client";
import { prisma } from "@/lib/db";
import { SupabaseStorageService } from "@/lib/services/storage/supabase-storage";
import { getAiNormalizer } from "@/lib/services/ai";

export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    name: "Process Document",
    retries: 3,
    triggers: [{ event: "document/uploaded" }],
  },
  async ({ event, step }) => {
    const { documentId } = event.data as { documentId: string };

    // Step 1: Load document and mark as processing
    const doc = await step.run("load-document", async () => {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { file: true },
      });

      if (!document || !document.file) {
        throw new Error(`Document or file not found: ${documentId}`);
      }

      await prisma.document.update({
        where: { id: documentId },
        data: { status: "processing" },
      });

      await prisma.processingStep.create({
        data: {
          documentId,
          stepName: "processing",
          status: "started",
          startedAt: new Date(),
        },
      });

      return {
        id: document.id,
        companyId: document.companyId,
        filePath: document.file.filePath,
        fileName: document.file.fileName,
        mimeType: document.file.mimeType,
      };
    });

    // Step 2: Download file and convert to images
    const imageData = await step.run("prepare-images", async () => {
      const startTime = Date.now();

      await prisma.processingStep.create({
        data: {
          documentId,
          stepName: "ocr",
          status: "started",
          startedAt: new Date(),
        },
      });

      const storage = new SupabaseStorageService();
      const fileBuffer = await storage.retrieve(doc.filePath);

      // Send the raw file buffer directly to the AI normalizer.
      // For PDFs: Claude accepts them as document blocks (no conversion needed).
      // For images: sent as image blocks.
      return {
        fileBase64: fileBuffer.toString("base64"),
        mimeType: doc.mimeType,
        durationMs: Date.now() - startTime,
      };
    });

    // Step 3: AI extraction + normalization
    const normalizedData = await step.run("ai-normalize", async () => {
      const startTime = Date.now();
      const normalizer = getAiNormalizer();

      // Deserialize file buffer from base64
      const fileBuffer = Buffer.from(imageData.fileBase64, "base64");

      const result = await normalizer.normalize(
        [fileBuffer],
        imageData.mimeType,
        { fileName: doc.fileName }
      );

      // Store OcrResult (raw extracted text)
      await prisma.ocrResult.create({
        data: {
          documentId,
          provider: "claude-vision",
          rawPayload: { text: result.extracted_text },
          confidence: result.confidence,
          pageCount: 1,
          processingTimeMs: Date.now() - startTime,
        },
      });

      // Update OCR processing step
      const ocrStep = await prisma.processingStep.findFirst({
        where: { documentId, stepName: "ocr", status: "started" },
        orderBy: { startedAt: "desc" },
      });
      if (ocrStep) {
        await prisma.processingStep.update({
          where: { id: ocrStep.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
          },
        });
      }

      // Store AiResult (structured JSON)
      await prisma.aiResult.create({
        data: {
          documentId,
          provider: process.env.AI_PROVIDER === "claude" ? "claude" : "mock",
          promptVersion: "v1",
          rawPayload: result as any,
          normalizedData: result as any,
          confidence: result.confidence,
          processingTimeMs: Date.now() - startTime,
        },
      });

      await prisma.processingStep.create({
        data: {
          documentId,
          stepName: "normalization",
          status: "completed",
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      return result;
    });

    // Step 4: Populate canonical fields on Document
    await step.run("populate-canonical", async () => {
      const startTime = Date.now();

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "extracted",
          documentType: (normalizedData.document_type as any) || "other",
          supplierNameRaw: normalizedData.supplier_name_raw,
          supplierNameNormalized: normalizedData.supplier_name_normalized,
          invoiceNumber: normalizedData.invoice_number,
          invoiceDate: normalizedData.invoice_date
            ? new Date(normalizedData.invoice_date)
            : null,
          dueDate: normalizedData.due_date
            ? new Date(normalizedData.due_date)
            : null,
          currency: normalizedData.currency,
          netAmount: normalizedData.net_amount,
          vatAmount: normalizedData.vat_amount,
          grossAmount: normalizedData.gross_amount,
          vatRatesDetected: normalizedData.vat_rates,
          iban: normalizedData.iban,
          paymentReference: normalizedData.payment_reference,
          expenseCategory: normalizedData.expense_category_suggestion,
          accountCode: normalizedData.account_code_suggestion,
          costCenter: normalizedData.cost_center_suggestion,
          confidenceScore: normalizedData.confidence,
        },
      });

      await prisma.processingStep.create({
        data: {
          documentId,
          stepName: "extraction",
          status: "completed",
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });
    });

    // Step 5: Basic validation — in Phase 2, all documents go to needs_review
    await step.run("basic-validation", async () => {
      const startTime = Date.now();

      const hasGross = normalizedData.gross_amount != null;
      const hasDate = normalizedData.invoice_date != null;
      const hasSupplier = normalizedData.supplier_name_raw != null;

      const validationResults = {
        checks: [
          {
            name: "gross_amount_present",
            passed: hasGross,
            severity: hasGross ? "info" : "warning",
            message: hasGross
              ? "Bruttobetrag vorhanden"
              : "Bruttobetrag fehlt",
          },
          {
            name: "invoice_date_present",
            passed: hasDate,
            severity: hasDate ? "info" : "warning",
            message: hasDate
              ? "Rechnungsdatum vorhanden"
              : "Rechnungsdatum fehlt",
          },
          {
            name: "supplier_present",
            passed: hasSupplier,
            severity: hasSupplier ? "info" : "warning",
            message: hasSupplier
              ? "Lieferant erkannt"
              : "Lieferant nicht erkannt",
          },
        ],
      };

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "needs_review",
          processingDecision: "needs_review",
          reviewStatus: "pending",
          validationResults: validationResults as any,
        },
      });

      // Complete the processing step
      const processingStep = await prisma.processingStep.findFirst({
        where: { documentId, stepName: "processing", status: "started" },
        orderBy: { startedAt: "desc" },
      });
      if (processingStep) {
        await prisma.processingStep.update({
          where: { id: processingStep.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            durationMs: Date.now() - new Date(processingStep.startedAt).getTime(),
          },
        });
      }

      await prisma.processingStep.create({
        data: {
          documentId,
          stepName: "validation",
          status: "completed",
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });
    });

    return { documentId, status: "needs_review" };
  }
);

export const exportDocument = inngest.createFunction(
  {
    id: "export-document",
    name: "Export Document",
    triggers: [{ event: "document/export-requested" }],
  },
  async ({ event, step }) => {
    // Will be implemented in Phase 4
  }
);
