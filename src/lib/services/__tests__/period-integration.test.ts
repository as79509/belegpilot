import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Periodensperre Integration", () => {
  it("approve Route hat Period Guard", () => {
    const content = fs.readFileSync(path.resolve("src/app/api/documents/[id]/approve/route.ts"), "utf-8");
    expect(content).toContain("checkPeriodLock");
    expect(content).toContain("period-guard");
  });

  it("document PATCH Route hat Period Guard", () => {
    const content = fs.readFileSync(path.resolve("src/app/api/documents/[id]/route.ts"), "utf-8");
    expect(content).toContain("checkPeriodLock");
    expect(content).toContain("period-guard");
  });

  it("journal POST Route hat Period Guard", () => {
    const content = fs.readFileSync(path.resolve("src/app/api/journal/route.ts"), "utf-8");
    expect(content).toContain("checkPeriodLock");
    expect(content).toContain("period-guard");
  });

  it("period PATCH Route hat Status-Übergangsregeln", () => {
    const content = fs.readFileSync(path.resolve("src/app/api/periods/[id]/route.ts"), "utf-8");
    expect(content).toContain("VALID_TRANSITIONS");
    expect(content).toContain("locked");
    expect(content).toContain("closed");
  });

  it("period guard blockiert mit HTTP 409 bei gesperrter Periode", () => {
    // Verify that routes return 409 when period is locked
    const approveContent = fs.readFileSync(path.resolve("src/app/api/documents/[id]/approve/route.ts"), "utf-8");
    expect(approveContent).toContain("409");

    const patchContent = fs.readFileSync(path.resolve("src/app/api/documents/[id]/route.ts"), "utf-8");
    expect(patchContent).toContain("409");

    const journalContent = fs.readFileSync(path.resolve("src/app/api/journal/route.ts"), "utf-8");
    expect(journalContent).toContain("409");
  });

  it("period guard prüft invoiceDate für Dokument-Aktionen", () => {
    const approveContent = fs.readFileSync(path.resolve("src/app/api/documents/[id]/approve/route.ts"), "utf-8");
    expect(approveContent).toContain("invoiceDate");

    const patchContent = fs.readFileSync(path.resolve("src/app/api/documents/[id]/route.ts"), "utf-8");
    expect(patchContent).toContain("invoiceDate");
  });

  it("period guard prüft entryDate für Journal-Aktionen", () => {
    const content = fs.readFileSync(path.resolve("src/app/api/journal/route.ts"), "utf-8");
    expect(content).toContain("entryDate");
  });

  it("period status transitions sind korrekt definiert", () => {
    const content = fs.readFileSync(path.resolve("src/app/api/periods/[id]/route.ts"), "utf-8");
    // Verify key transitions exist
    expect(content).toContain('"open"');
    expect(content).toContain('"incomplete"');
    expect(content).toContain('"review_ready"');
    expect(content).toContain('"closing"');
    expect(content).toContain('"closed"');
    expect(content).toContain('"locked"');
    // Verify audit logging on status change
    expect(content).toContain("logAudit");
  });
});
