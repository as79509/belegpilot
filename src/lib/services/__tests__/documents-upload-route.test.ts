import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveCompanyMock = vi.fn();
const hasPermissionMock = vi.fn();
const generateDocumentNumberMock = vi.fn();
const dispatchDocumentProcessingMock = vi.fn();
const rateLimitMock = vi.fn();
const storeMock = vi.fn();

const prismaMock = {
  documentFile: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  document: {
    create: vi.fn(),
  },
  processingStep: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/get-active-company", () => ({
  getActiveCompany: getActiveCompanyMock,
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: hasPermissionMock,
}));

vi.mock("@/lib/services/document-number", () => ({
  generateDocumentNumber: generateDocumentNumberMock,
}));

vi.mock("@/lib/services/documents/document-processing-dispatch", () => ({
  dispatchDocumentProcessing: dispatchDocumentProcessingMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
}));

vi.mock("@/lib/services/storage/supabase-storage", () => ({
  SupabaseStorageService: class {
    store = storeMock;
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

describe("documents upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveCompanyMock.mockResolvedValue({
      companyId: "company-1",
      session: { user: { id: "user-1", role: "admin" } },
    });
    hasPermissionMock.mockReturnValue(true);
    rateLimitMock.mockReturnValue({ allowed: true });
    prismaMock.documentFile.findFirst.mockResolvedValue(null);
    prismaMock.documentFile.create.mockResolvedValue(undefined);
    prismaMock.processingStep.create.mockResolvedValue(undefined);
    storeMock.mockResolvedValue("company-1/2026/04/test.pdf");
    generateDocumentNumberMock
      .mockResolvedValueOnce("BP-2026-0100")
      .mockResolvedValueOnce("BP-2026-0101")
      .mockResolvedValueOnce("BP-2026-0102");
    dispatchDocumentProcessingMock.mockResolvedValue({ ok: true });
  });

  it("wiederholt den Document-Create bei document_number-Konflikten ohne neuen Storage-Write", async () => {
    prismaMock.document.create
      .mockRejectedValueOnce(new Error("P2002 Unique constraint failed on the fields: (`document_number`)"))
      .mockRejectedValueOnce(new Error("P2002 Unique constraint failed on the fields: (`document_number`)"))
      .mockResolvedValueOnce({ id: "doc-1" });

    const { POST } = await import("@/app/api/documents/upload/route");

    const formData = new FormData();
    formData.append(
      "files",
      new File([Buffer.from("pdf-data")], "rechnung.pdf", { type: "application/pdf" })
    );

    const response = await POST({
      formData: vi.fn().mockResolvedValue(formData),
    } as any);

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(storeMock).toHaveBeenCalledTimes(1);
    expect(generateDocumentNumberMock).toHaveBeenCalledTimes(3);
    expect(prismaMock.document.create).toHaveBeenCalledTimes(3);
    expect(prismaMock.documentFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: "doc-1",
        filePath: "company-1/2026/04/test.pdf",
        fileName: "rechnung.pdf",
      }),
    });
    expect(data.results).toEqual([
      {
        documentId: "doc-1",
        fileName: "rechnung.pdf",
        status: "created",
      },
    ]);
  });
});
