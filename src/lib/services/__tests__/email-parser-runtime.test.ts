import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  documentFile: { findFirst: vi.fn(), create: vi.fn() },
  document: { create: vi.fn() },
  processingStep: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    documentFile: prismaMock.documentFile,
    document: prismaMock.document,
    processingStep: prismaMock.processingStep,
  },
}));

const storeMock = vi.fn();
vi.mock("@/lib/services/storage/supabase-storage", () => ({
  SupabaseStorageService: class {
    store = storeMock;
  },
}));

const generateDocumentNumberMock = vi.fn();
vi.mock("@/lib/services/document-number", () => ({
  generateDocumentNumber: generateDocumentNumberMock,
}));

const dispatchDocumentProcessingMock = vi.fn();
vi.mock("@/lib/services/documents/document-processing-dispatch", () => ({
  dispatchDocumentProcessing: dispatchDocumentProcessingMock,
}));

describe("email parser runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentFile.findFirst.mockResolvedValue(null);
    prismaMock.documentFile.create.mockResolvedValue(undefined);
    prismaMock.document.create.mockResolvedValue({ id: "doc-1" });
    prismaMock.processingStep.create.mockResolvedValue(undefined);
    storeMock.mockResolvedValue("company-1/test.pdf");
    generateDocumentNumberMock.mockResolvedValue("DOC-1");
  });

  it("legt Mail-Anhänge ehrlich als sonstige Belege an und meldet Dispatch-Fehler zurück", async () => {
    dispatchDocumentProcessingMock.mockResolvedValue({
      ok: false,
      error: "Verarbeitung konnte nicht gestartet werden: Queue offline",
    });

    const { processEmailAttachments } = await import("@/lib/services/email/email-parser");
    const result = await processEmailAttachments("company-1", {
      from: "buchhaltung@example.com",
      to: "inbox@belege.belegpilot.ch",
      subject: "Rechnung",
      textBody: null,
      htmlBody: null,
      receivedAt: new Date("2026-04-14T10:00:00.000Z"),
      messageId: "msg-1",
      attachments: [
        {
          filename: "rechnung.pdf",
          contentType: "application/pdf",
          size: 1024,
          content: Buffer.from("pdf"),
        },
      ],
    });

    expect(prismaMock.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        status: "uploaded",
        documentType: "other",
      }),
    });
    expect(dispatchDocumentProcessingMock).toHaveBeenCalledWith({
      companyId: "company-1",
      documentId: "doc-1",
      source: "email",
    });
    expect(result).toEqual({
      documentIds: ["doc-1"],
      createdCount: 0,
      duplicateCount: 0,
      failedAttachments: [
        {
          filename: "rechnung.pdf",
          error: "Verarbeitung konnte nicht gestartet werden: Queue offline",
        },
      ],
    });
  });

  it("zählt Duplikate getrennt und erstellt keinen zweiten Beleg", async () => {
    prismaMock.documentFile.findFirst.mockResolvedValue({
      document: { id: "doc-existing", companyId: "company-1" },
    });

    const { processEmailAttachments } = await import("@/lib/services/email/email-parser");
    const result = await processEmailAttachments("company-1", {
      from: "buchhaltung@example.com",
      to: "inbox@belege.belegpilot.ch",
      subject: "Rechnung",
      textBody: null,
      htmlBody: null,
      receivedAt: new Date(),
      messageId: "msg-2",
      attachments: [
        {
          filename: "rechnung.pdf",
          contentType: "application/pdf",
          size: 1024,
          content: Buffer.from("pdf"),
        },
      ],
    });

    expect(prismaMock.document.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      documentIds: ["doc-existing"],
      createdCount: 0,
      duplicateCount: 1,
      failedAttachments: [],
    });
  });
});
