import { inngest } from "./client";
import { prisma } from "@/lib/db";
import { SupabaseStorageService } from "@/lib/services/storage/supabase-storage";
import { getAiNormalizer } from "@/lib/services/ai";
import { toCanonical } from "@/lib/types/canonical";
import { validateDocument } from "@/lib/services/validation/validation-engine";
import {
  buildConfidenceFactors,
  computeCompositeConfidence,
} from "@/lib/services/validation/confidence";
import { makeProcessingDecision } from "@/lib/services/validation/decision";
import {
  findMatchingSupplier,
  createSupplierFromDocument,
} from "@/lib/services/supplier-matching/supplier-matcher";
import { recordAiUsage } from "@/lib/services/ai/cost-tracker";

export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    name: "Process Document",
    retries: 3,
    triggers: [{ event: "document/uploaded" }],
    onFailure: async ({ error, event }: any) => {
      // Mark document as failed after all retries exhausted
      const { documentId } = event.data?.event?.data || event.data || {} as any;
      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "failed" },
        });
        await prisma.processingStep.create({
          data: {
            documentId,
            stepName: "processing",
            status: "failed",
            startedAt: new Date(),
            completedAt: new Date(),
            errorMessage: error.message || "Unbekannter Fehler",
            errorDetails: { stack: error.stack } as any,
          },
        });
      } catch {
        console.error("[processDocument] onFailure handler error for", documentId);
      }
    },
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

      const aiResult = await normalizer.normalize(
        [fileBuffer],
        imageData.mimeType,
        { fileName: doc.fileName }
      );

      const result = aiResult.data;

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

      // Record AI usage for cost tracking
      if (aiResult.usage) {
        try {
          await recordAiUsage({
            companyId: doc.companyId,
            documentId,
            provider: aiResult.usage.model.includes("claude") ? "anthropic" : "mock",
            model: aiResult.usage.model,
            inputTokens: aiResult.usage.inputTokens,
            outputTokens: aiResult.usage.outputTokens,
          });
        } catch {
          // Non-critical — don't fail processing if cost tracking fails
        }
      }

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

    // Step 5: Supplier matching + auto-creation
    const supplierMatchResult = await step.run("supplier-matching", async () => {
      const startTime = Date.now();
      const updatedDoc = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!updatedDoc) throw new Error("Document not found");

      const vatNum = normalizedData.supplier_vat_number || null;
      const docIban = updatedDoc.iban;
      const nameNorm = updatedDoc.supplierNameNormalized;

      let supplierId: string | null = null;
      let matchCertainty = 0;

      // Try to match existing supplier
      const match = await findMatchingSupplier(
        doc.companyId,
        vatNum,
        docIban,
        nameNorm
      );

      if (match) {
        supplierId = match.supplierId;
        matchCertainty = match.confidence;

        // Increment document count
        await prisma.supplier.update({
          where: { id: supplierId },
          data: { documentCount: { increment: 1 } },
        });

        // Apply verified supplier defaults as suggestions
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
        });
        if (supplier?.isVerified) {
          const defaults: Record<string, any> = {};
          if (!updatedDoc.expenseCategory && supplier.defaultCategory)
            defaults.expenseCategory = supplier.defaultCategory;
          if (!updatedDoc.accountCode && supplier.defaultAccountCode)
            defaults.accountCode = supplier.defaultAccountCode;
          if (!updatedDoc.costCenter && supplier.defaultCostCenter)
            defaults.costCenter = supplier.defaultCostCenter;
          if (Object.keys(defaults).length > 0) {
            await prisma.document.update({
              where: { id: documentId },
              data: defaults,
            });
          }
        }
      } else if (nameNorm?.trim()) {
        // Auto-create new supplier
        supplierId = await createSupplierFromDocument(
          doc.companyId,
          nameNorm,
          updatedDoc.supplierNameRaw,
          vatNum,
          docIban
        );
        matchCertainty = 0;
      }

      // Link document to supplier
      if (supplierId) {
        await prisma.document.update({
          where: { id: documentId },
          data: { supplierId },
        });
      }

      await prisma.processingStep.create({
        data: {
          documentId,
          stepName: "supplier-matching",
          status: "completed",
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          metadata: {
            matchType: match?.matchType || "created",
            matchCertainty,
            supplierId,
          },
        },
      });

      return { supplierId, matchCertainty };
    });

    // Step 6: Full validation engine
    const decision = await step.run("validate", async () => {
      const startTime = Date.now();

      const updatedDoc = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!updatedDoc) throw new Error("Document not found after extraction");

      const canonical = toCanonical(updatedDoc);

      // Get existing documents for duplicate check
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const existingDocs = await prisma.document.findMany({
        where: {
          companyId: doc.companyId,
          id: { not: documentId },
          createdAt: { gte: oneYearAgo },
          supplierNameNormalized: { not: null },
          invoiceNumber: { not: null },
        },
        select: {
          id: true,
          supplierNameNormalized: true,
          invoiceNumber: true,
          grossAmount: true,
        },
      });

      const dupCheckDocs = existingDocs.map((d) => ({
        id: d.id,
        supplierNameNormalized: d.supplierNameNormalized,
        invoiceNumber: d.invoiceNumber,
        grossAmount: d.grossAmount ? Number(d.grossAmount) : null,
      }));

      const validationResult = validateDocument(canonical, dupCheckDocs);

      const aiConfidence = normalizedData.confidence || 0;
      const factors = buildConfidenceFactors(
        aiConfidence,
        canonical,
        validationResult,
        supplierMatchResult.matchCertainty
      );
      const compositeConfidence = computeCompositeConfidence(factors);

      const processingDecision = makeProcessingDecision(
        validationResult,
        compositeConfidence
      );
      const newStatus =
        processingDecision === "auto_ready" ? "ready" : "needs_review";

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: newStatus,
          processingDecision,
          reviewStatus: "pending",
          confidenceScore: compositeConfidence,
          validationResults: validationResult as any,
        },
      });

      // Complete the overall processing step
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
            durationMs:
              Date.now() - new Date(processingStep.startedAt).getTime(),
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
          metadata: {
            checks_passed: validationResult.checks.filter((c) => c.passed).length,
            checks_failed: validationResult.checks.filter((c) => !c.passed).length,
            decision: processingDecision,
            compositeConfidence,
          },
        },
      });

      return { decision: processingDecision, status: newStatus };
    });

    return { documentId, status: decision.status };
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
