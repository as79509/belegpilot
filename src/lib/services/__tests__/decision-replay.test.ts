import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Decision Replay Code Audit", () => {
  const replayPath = path.resolve(
    process.cwd(),
    "src/app/api/documents/[id]/decision-replay/route.ts"
  );
  const content = fs.readFileSync(replayPath, "utf-8");

  it("Autopilot Snapshot wird strukturiert ausgegeben, nicht als Record<string, boolean>", () => {
    // Darf NICHT mehr den flachen Cast enthalten
    expect(content).not.toContain("as Record<string, boolean>");
    // Muss den strukturierten Snapshot enthalten
    expect(content).toContain("snapshot?.checks");
    expect(content).toContain("snapshot?.suggestion");
  });

  it("Rules werden primaer ueber IDs geladen", () => {
    expect(content).toContain("rulesMatchedIds");
    expect(content).toContain("id: { in: ruleIds }");
  });

  it("Legacy-Fallback ueber Namen existiert noch", () => {
    expect(content).toContain("name: { in: ruleNames }");
  });

  it("Globale Regeln werden gefunden (kein Company-Filter bei ID-Lookup)", () => {
    // Bei ID-basiertem Lookup: kein companyId Filter
    const idStart = content.indexOf("if (ruleIds.length > 0)");
    const nameStart = content.indexOf("else if (ruleNames");
    expect(idStart).toBeGreaterThan(-1);
    expect(nameStart).toBeGreaterThan(-1);
    const idLookupSection = content.slice(idStart, nameStart);
    expect(idLookupSection).not.toContain("companyId: ctx.companyId");
  });
});

describe("Rules Engine Metadata", () => {
  const enginePath = path.resolve(
    process.cwd(),
    "src/lib/inngest/functions.ts"
  );
  const content = fs.readFileSync(enginePath, "utf-8");

  it("speichert rulesMatchedIds in ProcessingStep metadata", () => {
    expect(content).toContain("rulesMatchedIds");
  });
});
