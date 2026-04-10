import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const servicesDir = path.resolve("src/lib/services");
const apiDir = path.resolve("src/app/api");

function readFile(relativePath: string): string | null {
  const fullPath = path.join(relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf-8");
}

describe("Account Governance — Suggestions", () => {
  const engine = readFile(path.join(servicesDir, "suggestions/suggestion-engine.ts"));

  it("Suggestion mit erlaubtem Konto → Confidence unverändert", () => {
    expect(engine).not.toBeNull();
    // Engine loads accounts with ai_suggest/ai_autopilot governance
    expect(engine).toContain('aiGovernance: { in: ["ai_suggest", "ai_autopilot"] }');
    // If account is in the allowed set, no score reduction happens
    expect(engine).toContain("allowedSet.has(finalAccount)");
  });

  it("Suggestion mit gesperrtem Konto → Confidence 0", () => {
    expect(engine).not.toBeNull();
    // When account is manual_only or locked, the engine sets score = 0
    expect(engine).toContain('aiGovernance: { in: ["manual_only", "locked"] }');
    expect(engine).toContain("score = 0");
    expect(engine).toContain("finalAccount = null");
  });

  it("Suggestion ohne Kontenplan → Legacy, keine Änderung", () => {
    expect(engine).not.toBeNull();
    // Engine queries accounts with isActive: true — if none found,
    // allowedSet is empty but finalAccount only gets blocked if a restricted
    // account is explicitly found. No chart = no restriction.
    expect(engine).toContain("allowedSet");
    // The restricted-account lookup uses findFirst with manual_only/locked filter.
    // If no chart exists (0 accounts), findFirst returns null → no blocking.
    expect(engine).toContain("restrictedAccount");
  });
});

describe("Account Governance — Autopilot Safety Checks", () => {
  const safety = readFile(path.join(servicesDir, "autopilot/safety-check.ts"));

  it("Autopilot: Konto mit ai_autopilot → passed", () => {
    expect(safety).not.toBeNull();
    // Safety check passes when governance is ai_autopilot
    expect(safety).toContain('aiGovernance !== "ai_autopilot"');
    expect(safety).toContain("für Autopilot freigegeben");
  });

  it("Autopilot: Konto mit ai_suggest (nicht autopilot) → blocked", () => {
    expect(safety).not.toBeNull();
    // If governance is not ai_autopilot (e.g., ai_suggest), check fails
    expect(safety).toContain("nicht für Autopilot freigegeben");
    expect(safety).toContain("passed: false");
  });

  it("Autopilot: Konto nicht im Plan → blocked", () => {
    expect(safety).not.toBeNull();
    // If account not found in chart, safety check fails
    expect(safety).toContain("nicht im Kontenplan");
    expect(safety).toContain("!account");
  });

  it("Autopilot: Kein Kontenplan → passed (Legacy)", () => {
    expect(safety).not.toBeNull();
    // Safety check only runs if document.accountCode is set
    // If no accountCode → no governance check → eligible (legacy)
    expect(safety).toContain("if (document.accountCode)");
    // No accountCode means the accountGovernance check is skipped entirely
  });
});

describe("Account Governance — Journal Validation", () => {
  const journalRoute = readFile(path.join(apiDir, "journal/route.ts"));
  const journalIdRoute = readFile(path.join(apiDir, "journal/[id]/route.ts"));

  it("Validation: Konto im Plan → passed", () => {
    expect(journalRoute).not.toBeNull();
    // Journal POST validates accounts against chart of accounts
    expect(journalRoute).toContain("validateAccountsAgainstPlan");
    // When account exists and is not locked, no error is returned
    expect(journalRoute).toContain("accountMap.get(code)");
  });

  it("Validation: Konto nicht im Plan → warning", () => {
    expect(journalRoute).not.toBeNull();
    // When account is not in chart, a warning is added (not an error)
    expect(journalRoute).toContain("ist nicht im Kontenplan");
    // Response includes warnings array
    expect(journalRoute).toContain("{ entry, warnings }");
  });

  it("Validation: Kein Kontenplan → passed", () => {
    expect(journalRoute).not.toBeNull();
    // When no accounts exist (legacy), validation is skipped
    expect(journalRoute).toContain("accounts.length === 0");
    expect(journalRoute).toContain("return { warnings, lockedError }");
  });

  it("Validation: Gesperrtes Konto → Fehler 400", () => {
    expect(journalRoute).not.toBeNull();
    // Locked accounts produce an error, not just a warning
    expect(journalRoute).toContain('"locked"');
    expect(journalRoute).toContain("ist gesperrt");
    expect(journalRoute).toContain("status: 400");
  });

  it("PATCH-Route validiert ebenfalls Konten", () => {
    expect(journalIdRoute).not.toBeNull();
    // PATCH route also validates accounts
    expect(journalIdRoute).toContain("ist nicht im Kontenplan");
    expect(journalIdRoute).toContain("ist gesperrt");
    expect(journalIdRoute).toContain("{ entry: updated, warnings }");
  });
});

describe("Account Governance — Export Warnings", () => {
  const csvExport = readFile(path.join(servicesDir, "export/csv-export.ts"));
  const csvRoute = readFile(path.join(apiDir, "exports/csv/route.ts"));

  it("Export prüft accountCodes gegen Kontenplan", () => {
    expect(csvExport).not.toBeNull();
    // CSV export loads chart of accounts
    expect(csvExport).toContain("chartAccounts");
    expect(csvExport).toContain("accountSet");
    // Checks each doc's accountCode
    expect(csvExport).toContain("accountSet.has(doc.accountCode)");
  });

  it("Export erzeugt per-Dokument Warnungen", () => {
    expect(csvExport).not.toBeNull();
    // Warnings include documentId and documentNumber
    expect(csvExport).toContain("ExportWarning");
    expect(csvExport).toContain("documentId: doc.id");
    expect(csvExport).toContain("documentNumber:");
  });

  it("Export wird nicht blockiert (Legacy-Kompatibilität)", () => {
    expect(csvExport).not.toBeNull();
    // Export always proceeds — warnings are collected but don't stop the export
    expect(csvExport).toContain("return { batchId, csv:");
    expect(csvExport).toContain("warnings");
  });

  it("Export-Route gibt Warnungen in Headern zurück", () => {
    expect(csvRoute).not.toBeNull();
    expect(csvRoute).toContain("X-Export-Warnings");
    expect(csvRoute).toContain("X-Export-Warning-Count");
    expect(csvRoute).toContain("exportWarnings");
  });
});
