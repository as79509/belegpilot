import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    monthlyPeriod: { findUnique: vi.fn() },
  },
}));

import { checkPeriodLock } from "../period-guard";
import { prisma } from "@/lib/db";

const mockFindUnique = prisma.monthlyPeriod.findUnique as ReturnType<typeof vi.fn>;

describe("checkPeriodLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keine Periode → locked: false", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await checkPeriodLock("comp-1", new Date(2026, 2, 15));
    expect(result).toEqual({ locked: false });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { companyId_year_month: { companyId: "comp-1", year: 2026, month: 3 } },
    });
  });

  it("Periode mit status 'open' → locked: false", async () => {
    mockFindUnique.mockResolvedValue({ id: "p-1", status: "open" });
    const result = await checkPeriodLock("comp-1", new Date(2026, 0, 10));
    expect(result).toEqual({ locked: false });
  });

  it("Periode mit status 'locked' → locked: true mit Message", async () => {
    mockFindUnique.mockResolvedValue({ id: "p-2", status: "locked" });
    const result = await checkPeriodLock("comp-1", new Date(2026, 5, 20));
    expect(result).toEqual({ locked: true, message: "Periode 6/2026 ist gesperrt" });
  });

  it("Periode mit status 'closed' → locked: false", async () => {
    mockFindUnique.mockResolvedValue({ id: "p-3", status: "closed" });
    const result = await checkPeriodLock("comp-1", new Date(2026, 11, 1));
    expect(result).toEqual({ locked: false });
  });
});
