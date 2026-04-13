import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getActiveCompanyMock = vi.fn();
const hasPermissionMock = vi.fn();
const logAuditMock = vi.fn();

const prismaMock = {
  supplier: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/get-active-company", () => ({
  getActiveCompany: getActiveCompanyMock,
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: hasPermissionMock,
}));

vi.mock("@/lib/services/audit/audit-service", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

describe("supplier create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveCompanyMock.mockResolvedValue({
      companyId: "company-1",
      session: { user: { id: "user-1", role: "admin" } },
    });
    hasPermissionMock.mockReturnValue(true);
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.supplier.create.mockResolvedValue({
      id: "supplier-1",
      nameNormalized: "Muster AG",
      vatNumber: "CHE-123",
      iban: "CH9300762011623852957",
      defaultCategory: "Büro",
      defaultAccountCode: "4200",
      paymentTermDays: 30,
    });
  });

  it("erstellt einen Lieferanten tenant-sicher und auditierbar", async () => {
    const { POST } = await import("@/app/api/suppliers/route");
    const request = new NextRequest("http://localhost/api/suppliers", {
      method: "POST",
      body: JSON.stringify({
        nameNormalized: "Muster AG",
        vatNumber: "CHE-123",
        iban: "CH9300762011623852957",
        defaultCategory: "Büro",
        defaultAccountCode: "4200",
        paymentTermDays: "30",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        companyId: "company-1",
      }),
    }));
    expect(prismaMock.supplier.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyId: "company-1",
        nameNormalized: "Muster AG",
        nameVariants: ["Muster AG"],
        paymentTermDays: 30,
      }),
    }));
    expect(logAuditMock).toHaveBeenCalledOnce();
    expect(data.supplier.id).toBe("supplier-1");
  });

  it("blockiert Duplikate ehrlich mit 409", async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: "supplier-existing" });

    const { POST } = await import("@/app/api/suppliers/route");
    const request = new NextRequest("http://localhost/api/suppliers", {
      method: "POST",
      body: JSON.stringify({ nameNormalized: "Muster AG" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(prismaMock.supplier.create).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
    expect(data.error).toContain("existiert bereits");
  });
});
