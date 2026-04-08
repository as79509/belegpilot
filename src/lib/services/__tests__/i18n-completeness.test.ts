import { describe, it, expect } from "vitest";
import { de } from "@/lib/i18n/de";

describe("i18n Vollständigkeit", () => {
  it("alle Top-Level Sections existieren", () => {
    const expected = [
      "common", "dashboard", "documents", "suppliers", "auditLog",
      "exports", "settings", "errors", "greeting", "cockpit",
      "documentList", "reviewCockpit", "periodDetail", "expectedDocs",
      "decisionReasons", "ruleTemplates", "globalRules",
    ];
    for (const key of expected) {
      expect(de, `Missing i18n section: ${key}`).toHaveProperty(key);
    }
  });

  it("cockpit Section hat alle kritischen Keys", () => {
    expect(de.cockpit).toHaveProperty("allGood");
    expect(de.cockpit).toHaveProperty("highRiskDocs");
    expect(de.cockpit).toHaveProperty("riskScore");
    expect(de.cockpit).toHaveProperty("openTasks");
  });

  it("keine leeren Strings in de.ts", () => {
    function checkEmpty(obj: any, path: string): string[] {
      const empties: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && v.trim() === "") empties.push(`${path}.${k}`);
        else if (typeof v === "object" && v !== null && typeof v !== "function") empties.push(...checkEmpty(v, `${path}.${k}`));
      }
      return empties;
    }
    expect(checkEmpty(de, "de")).toEqual([]);
  });

  it("periods.status hat alle erwarteten Zustände", () => {
    const expected = ["open", "incomplete", "review_ready", "closing", "closed", "locked"];
    for (const s of expected) {
      expect(de.periods.status, `Missing period status: ${s}`).toHaveProperty(s);
    }
  });

  it("document statuses sind vollständig", () => {
    const expected = ["uploaded", "processing", "extracted", "validated", "needs_review", "ready", "exported", "export_failed", "rejected", "failed", "archived"];
    for (const s of expected) {
      expect(de.status, `Missing document status: ${s}`).toHaveProperty(s);
    }
  });

  it("auditLog.actions deckt alle kritischen Aktionen ab", () => {
    const expected = [
      "document_approved", "document_rejected", "document_fields_edited",
      "rule_created", "rule_updated", "rule_deleted",
      "knowledge_created", "knowledge_updated",
      "period_locked", "period_unlocked",
    ];
    for (const a of expected) {
      expect(de.auditLog.actions, `Missing audit action: ${a}`).toHaveProperty(a);
    }
  });

  it("expectedDocs.status hat alle Zustände", () => {
    const expected = ["received", "missing", "amount_mismatch", "not_expected"];
    for (const s of expected) {
      expect(de.expectedDocs.status, `Missing expected doc status: ${s}`).toHaveProperty(s);
    }
  });
});
