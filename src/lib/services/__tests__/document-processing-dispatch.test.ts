import { describe, expect, it, vi } from "vitest";
import { dispatchDocumentProcessing } from "@/lib/services/documents/document-processing-dispatch";

describe("Document Processing Dispatch", () => {
  it("meldet Erfolg, wenn der Inngest-Handoff klappt", async () => {
    const prismaClient = {
      document: { update: vi.fn() },
      processingStep: { create: vi.fn() },
    } as any;
    const inngestClient = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    const trackErrorFn = vi.fn();

    const result = await dispatchDocumentProcessing(
      { companyId: "company-1", documentId: "doc-1", source: "upload" },
      { prismaClient, inngestClient, trackErrorFn }
    );

    expect(result).toEqual({ ok: true });
    expect(inngestClient.send).toHaveBeenCalledWith({
      name: "document/uploaded",
      data: { documentId: "doc-1" },
    });
    expect(prismaClient.document.update).not.toHaveBeenCalled();
    expect(prismaClient.processingStep.create).not.toHaveBeenCalled();
    expect(trackErrorFn).not.toHaveBeenCalled();
  });

  it("markiert das Dokument ehrlich als failed, wenn die Queue nicht startet", async () => {
    const prismaClient = {
      document: { update: vi.fn().mockResolvedValue(undefined) },
      processingStep: { create: vi.fn().mockResolvedValue(undefined) },
    } as any;
    const inngestClient = {
      send: vi.fn().mockRejectedValue(new Error("Queue offline")),
    };
    const trackErrorFn = vi.fn().mockResolvedValue(undefined);

    const result = await dispatchDocumentProcessing(
      { companyId: "company-1", documentId: "doc-1", source: "upload" },
      { prismaClient, inngestClient, trackErrorFn }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Verarbeitung konnte nicht gestartet werden");
    expect(prismaClient.document.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: {
        status: "failed",
        processingDecision: "failed",
      },
    });
    expect(prismaClient.processingStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: "doc-1",
        stepName: "processing",
        status: "failed",
        errorMessage: expect.stringContaining("Queue offline"),
        metadata: {
          source: "upload",
          stage: "queue",
        },
      }),
    });
    expect(trackErrorFn).toHaveBeenCalledWith({
      source: "inngest",
      message: expect.stringContaining("Queue offline"),
      documentId: "doc-1",
    });
  });
});
