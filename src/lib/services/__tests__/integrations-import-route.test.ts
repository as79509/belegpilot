import { beforeEach, describe, expect, it, vi } from "vitest";
const getActiveCompanyMock = vi.fn();
const hasPermissionMock = vi.fn();
const getAdapterMock = vi.fn();
const logAuditMock = vi.fn();

const prismaMock = {
  integration: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/get-active-company", () => ({
  getActiveCompany: getActiveCompanyMock,
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: hasPermissionMock,
}));

vi.mock("@/lib/services/integrations/provider-registry", () => ({
  getAdapter: getAdapterMock,
}));

vi.mock("@/lib/services/audit/audit-service", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/services/integrations/providers/csv-provider", () => ({}));
vi.mock("@/lib/services/integrations/providers/bexio-provider", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

describe("integrations import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveCompanyMock.mockResolvedValue({
      companyId: "company-1",
      session: { user: { id: "user-1", role: "admin" } },
    });
    hasPermissionMock.mockReturnValue(true);
  });

  it("blockiert Importe ehrlich, wenn die Integration nicht aktiviert ist", async () => {
    prismaMock.integration.findFirst.mockResolvedValue(null);
    getAdapterMock.mockReturnValue({
      provider: { supportedActions: ["import_accounts"] },
      executeImport: vi.fn(),
    });

    const { POST } = await import("@/app/api/integrations/[providerId]/import/route");
    const formData = new FormData();
    formData.append("action", "import_accounts");
    formData.append("file", new Blob(["a;b"], { type: "text/csv" }), "konten.csv");

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as any;

    const response = await POST(request, { params: Promise.resolve({ providerId: "csv" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("nicht aktiviert");
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("audit-loggt erfolgreiche Importe mit Provider und Ergebnis", async () => {
    const executeImport = vi.fn().mockResolvedValue({
      success: true,
      imported: 3,
      skipped: 1,
      errors: [],
    });
    prismaMock.integration.findFirst.mockResolvedValue({ id: "integration-1" });
    getAdapterMock.mockReturnValue({
      provider: { supportedActions: ["import_accounts"] },
      executeImport,
    });

    const { POST } = await import("@/app/api/integrations/[providerId]/import/route");
    const formData = new FormData();
    formData.append("action", "import_accounts");
    formData.append("file", new Blob(["konto;name"], { type: "text/csv" }), "konten.csv");

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as any;

    const response = await POST(request, { params: Promise.resolve({ providerId: "csv" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(executeImport).toHaveBeenCalledWith("company-1", "import_accounts", "konto;name", "konten.csv");
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      companyId: "company-1",
      action: "integration_import_executed",
      entityId: "integration-1",
      changes: expect.objectContaining({
        import: expect.objectContaining({
          after: expect.objectContaining({
            providerId: "csv",
            imported: 3,
            skipped: 1,
          }),
        }),
      }),
    }));
    expect(data.result.imported).toBe(3);
  });
});
