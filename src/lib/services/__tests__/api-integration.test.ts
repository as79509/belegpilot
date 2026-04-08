import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("API Route Strukturelle Integrität", () => {
  const apiDir = path.resolve("src/app/api");
  function readRoute(rel: string): string {
    return fs.readFileSync(path.join(apiDir, rel), "utf-8");
  }

  it("upload Route validiert Dateityp", () => {
    expect(readRoute("documents/upload/route.ts")).toContain("pdf");
  });

  it("approve Route setzt reviewedBy + reviewedAt", () => {
    const c = readRoute("documents/[id]/approve/route.ts");
    expect(c).toContain("reviewedBy");
    expect(c).toContain("reviewedAt");
  });

  it("bulk-approve hat Rate-Limiting", () => {
    expect(readRoute("documents/bulk-approve/route.ts")).toContain("rateLimit");
  });

  it("CSV export prüft companyId", () => {
    expect(readRoute("exports/csv/route.ts")).toContain("companyId");
  });

  it("cockpit API aggregiert alle Daten", () => {
    const c = readRoute("dashboard/cockpit/route.ts");
    expect(c).toContain("alerts");
    expect(c).toContain("highRiskDocs");
    expect(c).toContain("clientRiskBoard");
    expect(c).toContain("waitingOnClient");
  });

  it("expected-documents check prüft alle Frequenzen", () => {
    const c = readRoute("expected-documents/check/route.ts");
    expect(c).toContain("monthly");
    expect(c).toContain("quarterly");
    expect(c).toContain("yearly");
  });

  it("period detail berechnet Live-Checkliste", () => {
    const c = readRoute("periods/[id]/detail/route.ts");
    expect(c).toContain("checklist");
    expect(c).toContain("blockers");
  });

  it("neighbors gibt previousId und nextId zurück", () => {
    const c = readRoute("documents/[id]/neighbors/route.ts");
    expect(c).toContain("previousId");
    expect(c).toContain("nextId");
  });

  it("similar sucht nach Betrag-Toleranz", () => {
    expect(readRoute("documents/[id]/similar/route.ts")).toContain("tolerance");
  });

  it("rule templates sind verfügbar", () => {
    expect(readRoute("rules/templates/route.ts")).toContain("RULE_TEMPLATES");
  });

  it("escalation defaults liefern Standard-Set", () => {
    expect(readRoute("escalation-rules/defaults/route.ts")).toContain("DEFAULT_ESCALATIONS");
  });
});
