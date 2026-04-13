import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  bananaRoundTripEntry: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

describe("banana round-trip history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregiert persistierte Importzeilen zu echter Batch-Historie", async () => {
    prismaMock.bananaRoundTripEntry.findMany.mockResolvedValue([
      { importBatchId: "batch-neu", importedAt: new Date("2026-04-13T10:05:00.000Z"), matchStatus: "matched" },
      { importBatchId: "batch-neu", importedAt: new Date("2026-04-13T10:04:59.000Z"), matchStatus: "modified" },
      { importBatchId: "batch-neu", importedAt: new Date("2026-04-13T10:04:58.000Z"), matchStatus: "unmatched" },
      { importBatchId: "batch-alt", importedAt: new Date("2026-04-12T09:00:00.000Z"), matchStatus: "matched" },
      { importBatchId: "batch-alt", importedAt: new Date("2026-04-12T08:59:59.000Z"), matchStatus: "new_in_banana" },
    ]);

    const { listBananaImportBatches } = await import("@/lib/services/banana/banana-round-trip");
    const batches = await listBananaImportBatches("company-1");

    expect(batches).toEqual([
      {
        importBatchId: "batch-neu",
        importedAt: "2026-04-13T10:05:00.000Z",
        totalRows: 3,
        matched: 1,
        modified: 1,
        newInBanana: 0,
        unmatched: 1,
      },
      {
        importBatchId: "batch-alt",
        importedAt: "2026-04-12T09:00:00.000Z",
        totalRows: 2,
        matched: 1,
        modified: 0,
        newInBanana: 1,
        unmatched: 0,
      },
    ]);
  });
});
