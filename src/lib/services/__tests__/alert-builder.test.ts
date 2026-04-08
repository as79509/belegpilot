import { describe, it, expect } from "vitest";
import { buildAlerts } from "../cockpit/alert-builder";

const EMPTY = { failedDocs: 0, overdueContracts: 0, failedExports: 0, overdueTasks: 0, stuckProcessing: 0, needsReview: 0, expiringContracts: 0 };

describe("buildAlerts", () => {
  it("keine Probleme → leeres Array", () => {
    const alerts = buildAlerts(EMPTY);
    expect(alerts).toEqual([]);
  });

  it("failedDocs → error Alert mit href", () => {
    const alerts = buildAlerts({ ...EMPTY, failedDocs: 3 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("error");
    expect(alerts[0].key).toBe("failed_docs");
    expect(alerts[0].count).toBe(3);
    expect(alerts[0].href).toBe("/documents?status=failed");
  });

  it("needsReview → warning", () => {
    const alerts = buildAlerts({ ...EMPTY, needsReview: 5 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("warning");
    expect(alerts[0].key).toBe("needs_review");
    expect(alerts[0].count).toBe(5);
  });

  it("mehrere Probleme → errors zuerst, dann warnings", () => {
    const alerts = buildAlerts({
      failedDocs: 1, overdueContracts: 2, failedExports: 0,
      overdueTasks: 3, stuckProcessing: 1, needsReview: 5, expiringContracts: 1,
    });
    const errorAlerts = alerts.filter((a) => a.type === "error");
    const warningAlerts = alerts.filter((a) => a.type === "warning");
    expect(errorAlerts.length).toBeGreaterThan(0);
    expect(warningAlerts.length).toBeGreaterThan(0);
    // Errors come before warnings in the array
    const firstWarningIdx = alerts.findIndex((a) => a.type === "warning");
    const lastErrorIdx = alerts.map((a, i) => (a.type === "error" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
    expect(lastErrorIdx).toBeLessThan(firstWarningIdx);
  });

  it("jeder Alert hat gültigen href", () => {
    const alerts = buildAlerts({
      failedDocs: 1, overdueContracts: 1, failedExports: 1,
      overdueTasks: 1, stuckProcessing: 1, needsReview: 1, expiringContracts: 1,
    });
    expect(alerts).toHaveLength(7);
    for (const a of alerts) {
      expect(a.href.startsWith("/")).toBe(true);
      expect(a.message.length).toBeGreaterThan(0);
    }
  });

  it("Keys sind eindeutig", () => {
    const alerts = buildAlerts({
      failedDocs: 1, overdueContracts: 1, failedExports: 1,
      overdueTasks: 1, stuckProcessing: 1, needsReview: 1, expiringContracts: 1,
    });
    const keys = alerts.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("einzelner overdueTasks Alert", () => {
    const alerts = buildAlerts({ ...EMPTY, overdueTasks: 7 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe("overdue_tasks");
    expect(alerts[0].type).toBe("error");
    expect(alerts[0].href).toBe("/tasks");
  });

  it("stuckProcessing ist warning", () => {
    const alerts = buildAlerts({ ...EMPTY, stuckProcessing: 2 });
    expect(alerts[0].type).toBe("warning");
    expect(alerts[0].key).toBe("stuck");
  });

  it("expiringContracts ist warning", () => {
    const alerts = buildAlerts({ ...EMPTY, expiringContracts: 1 });
    expect(alerts[0].type).toBe("warning");
    expect(alerts[0].key).toBe("expiring");
    expect(alerts[0].href).toBe("/contracts");
  });
});
