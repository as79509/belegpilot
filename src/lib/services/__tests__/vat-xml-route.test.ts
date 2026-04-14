import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveCompanyMock = vi.fn();

const prismaMock = {
  vatReturn: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/get-active-company", () => ({
  getActiveCompany: getActiveCompanyMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

describe("vat xml route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveCompanyMock.mockResolvedValue({
      companyId: "company-1",
      session: { user: { id: "user-1", role: "admin" } },
    });
  });

  it("antwortet ehrlich mit 409 solange der XML-Export nicht produktiv verfÃ¼gbar ist", async () => {
    prismaMock.vatReturn.findFirst.mockResolvedValue({
      id: "vat-1",
      companyId: "company-1",
    });

    const { GET } = await import("@/app/api/vat/[id]/xml/route");
    const response = await GET({} as any, { params: Promise.resolve({ id: "vat-1" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(response.headers.get("X-Implementation-Status")).toBe("not_available");
    expect(data).toEqual(expect.objectContaining({
      implementationStatus: "not_available",
      vatReturnId: "vat-1",
    }));
    expect(String(data.error)).toContain("nicht produktiv");
  });

  it("liefert 404, wenn die angeforderte Abrechnung nicht zum Mandanten gehÃ¶rt", async () => {
    prismaMock.vatReturn.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/vat/[id]/xml/route");
    const response = await GET({} as any, { params: Promise.resolve({ id: "missing" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Nicht gefunden");
  });
});
