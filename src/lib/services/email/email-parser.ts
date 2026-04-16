import { prisma } from "@/lib/db";
import { SupabaseStorageService } from "@/lib/services/storage/supabase-storage";
import { generateDocumentNumber } from "@/lib/services/document-number";
import { createHash } from "crypto";
import { dispatchDocumentProcessing } from "@/lib/services/documents/document-processing-dispatch";

// -- Types --

export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  attachments: ParsedAttachment[];
  receivedAt: Date;
  messageId: string | null;
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export interface EmailAttachmentProcessingResult {
  documentIds: string[];
  createdCount: number;
  duplicateCount: number;
  failedAttachments: Array<{ filename: string; error: string }>;
}

// Allowed attachment types
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB

// -- Email Parsing --

/**
 * Parse an inbound email webhook payload into a structured ParsedEmail.
 * Supports common formats: Mailgun, SendGrid, and generic JSON.
 */
export function parseInboundEmail(payload: any): ParsedEmail {
  // Mailgun format
  if (payload.sender || payload["body-plain"]) {
    return parseMailgunFormat(payload);
  }

  // SendGrid format
  if (payload.envelope || payload.from?.email) {
    return parseSendGridFormat(payload);
  }

  // Generic / custom format
  return parseGenericFormat(payload);
}

export async function parseInboundEmailPayload(payload: any): Promise<ParsedEmail> {
  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    return parseFormDataPayload(payload);
  }

  return parseInboundEmail(payload);
}

function parseMailgunFormat(payload: any): ParsedEmail {
  const attachments = extractAttachments(payload.attachments);

  return {
    from: payload.sender || payload.from || "",
    to: payload.recipient || payload.To || payload.to || "",
    subject: payload.subject || payload.Subject || "",
    textBody: payload["body-plain"] || payload["stripped-text"] || null,
    htmlBody: payload["body-html"] || payload["stripped-html"] || null,
    attachments,
    receivedAt: payload.timestamp
      ? new Date(parseInt(payload.timestamp) * 1000)
      : new Date(),
    messageId: payload["Message-Id"] || payload["message-id"] || null,
  };
}

function parseSendGridFormat(payload: any): ParsedEmail {
  const attachments = extractAttachments(payload.attachments);

  const envelope = typeof payload.envelope === "string"
    ? safeJsonParse(payload.envelope) || {}
    : payload.envelope || {};

  return {
    from: envelope.from || payload.from?.email || payload.from || "",
    to: (envelope.to && envelope.to[0]) || payload.to || "",
    subject: payload.subject || "",
    textBody: payload.text || null,
    htmlBody: payload.html || null,
    attachments,
    receivedAt: new Date(),
    messageId: payload["message-id"] || null,
  };
}

function parseGenericFormat(payload: any): ParsedEmail {
  const attachments = extractAttachments(payload.attachments);

  return {
    from: payload.from || "",
    to: payload.to || "",
    subject: payload.subject || "",
    textBody: payload.text || payload.textBody || payload.body || null,
    htmlBody: payload.html || payload.htmlBody || null,
    attachments,
    receivedAt: payload.receivedAt ? new Date(payload.receivedAt) : new Date(),
    messageId: payload.messageId || payload["message-id"] || null,
  };
}

async function parseFormDataPayload(formData: FormData): Promise<ParsedEmail> {
  const envelope = safeJsonParse(readFormValue(formData, "envelope")) || {};
  const attachments = await extractAttachmentsFromFormData(formData);
  const timestamp = readFormValue(formData, "timestamp");
  const envelopeTo =
    envelope && typeof envelope === "object" && Array.isArray(envelope.to)
      ? envelope.to[0]
      : null;

  return {
    from:
      readFormValue(formData, "sender") ||
      readFormValue(formData, "from") ||
      (envelope && typeof envelope === "object" && typeof envelope.from === "string"
        ? envelope.from
        : "") ||
      "",
    to:
      readFormValue(formData, "recipient") ||
      readFormValue(formData, "to") ||
      envelopeTo ||
      "",
    subject: readFormValue(formData, "subject") || "",
    textBody:
      readFormValue(formData, "body-plain") ||
      readFormValue(formData, "stripped-text") ||
      readFormValue(formData, "text") ||
      readFormValue(formData, "body") ||
      null,
    htmlBody:
      readFormValue(formData, "body-html") ||
      readFormValue(formData, "stripped-html") ||
      readFormValue(formData, "html") ||
      null,
    attachments,
    receivedAt: timestamp ? new Date(parseInt(timestamp, 10) * 1000) : new Date(),
    messageId:
      readFormValue(formData, "Message-Id") ||
      readFormValue(formData, "message-id") ||
      null,
  };
}

// -- Attachment extraction (shared) --

function extractAttachments(raw: any): ParsedAttachment[] {
  const attachments: ParsedAttachment[] = [];

  const list = typeof raw === "string"
    ? safeJsonParse(raw) || []
    : Array.isArray(raw)
      ? raw
      : [];

  for (const att of list) {
    const contentType = att.contentType || att.content_type || att.type || att["content-type"] || "";
    const size = att.size || (att.content ? Buffer.byteLength(att.content, "base64") : 0);

    if (!isAllowedAttachment(contentType, size)) continue;

    attachments.push({
      filename: att.filename || att.name || "attachment.pdf",
      contentType: contentType.toLowerCase().split(";")[0].trim(),
      size,
      content: att.content instanceof Buffer
        ? att.content
        : Buffer.from(att.content || att.data || "", "base64"),
    });
  }

  return attachments;
}

async function extractAttachmentsFromFormData(formData: FormData): Promise<ParsedAttachment[]> {
  const attachments: ParsedAttachment[] = [];

  for (const [, value] of formData.entries()) {
    if (!(value instanceof File)) continue;

    const contentType = value.type || "";
    const size = value.size || 0;

    if (!isAllowedAttachment(contentType, size)) continue;

    attachments.push({
      filename: value.name || "attachment.pdf",
      contentType: contentType.toLowerCase().split(";")[0].trim(),
      size,
      content: Buffer.from(await value.arrayBuffer()),
    });
  }

  return attachments;
}

// -- Attachment Processing --

/**
 * Process email attachments: store files and create Document records.
 * Returns array of created Document IDs.
 */
export async function processEmailAttachments(
  companyId: string,
  email: ParsedEmail
): Promise<EmailAttachmentProcessingResult> {
  const storage = new SupabaseStorageService();
  const documentIds: string[] = [];
  const failedAttachments: Array<{ filename: string; error: string }> = [];
  let createdCount = 0;
  let duplicateCount = 0;

  for (const att of email.attachments) {
    try {
      // Check for duplicate via hash
      const fileHash = createHash("sha256").update(att.content).digest("hex");
      const existingFile = await prisma.documentFile.findFirst({
        where: { fileHash },
        include: { document: { select: { id: true, companyId: true } } },
      });

      if (existingFile && existingFile.document.companyId === companyId) {
        documentIds.push(existingFile.document.id);
        duplicateCount++;
        continue;
      }

      // Upload to storage
      const storagePath = await storage.store(
        att.filename,
        att.content,
        att.contentType,
        companyId
      );

      // Create Document
      const documentNumber = await generateDocumentNumber(companyId);
      const document = await prisma.document.create({
        data: {
          companyId,
          documentNumber,
          status: "uploaded",
          documentType: "other",
        },
      });

      // Create DocumentFile
      await prisma.documentFile.create({
        data: {
          documentId: document.id,
          filePath: storagePath,
          fileName: att.filename,
          mimeType: att.contentType,
          fileSize: att.size || att.content.length,
          fileHash,
        },
      });

      // Log processing step
      const now = new Date();
      await prisma.processingStep.create({
        data: {
          documentId: document.id,
          stepName: "email_import",
          status: "completed",
          startedAt: now,
          completedAt: now,
          durationMs: 0,
          metadata: {
            source: "email",
            from: email.from,
            subject: email.subject,
            messageId: email.messageId,
          } as any,
        },
      });

      // Trigger processing pipeline
      const dispatchResult = await dispatchDocumentProcessing({
        companyId,
        documentId: document.id,
        source: "email",
      });
      if (!dispatchResult.ok) {
        failedAttachments.push({
          filename: att.filename,
          error: dispatchResult.error || "Verarbeitung konnte nicht gestartet werden",
        });
      } else {
        createdCount++;
      }

      documentIds.push(document.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Anhang konnte nicht verarbeitet werden";
      console.error("[EmailImport] Failed to process attachment " + att.filename + ":", err);
      failedAttachments.push({ filename: att.filename, error: message });
    }
  }

  return { documentIds, createdCount, duplicateCount, failedAttachments };
}

// -- Helpers --

function isAllowedAttachment(contentType: string, size: number): boolean {
  if (!contentType) return false;
  const type = contentType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_CONTENT_TYPES.includes(type)) return false;
  if (size > MAX_ATTACHMENT_SIZE) return false;
  return true;
}

function safeJsonParse(val: any): any {
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function readFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}
