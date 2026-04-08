import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function getAllRouteFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...getAllRouteFiles(full));
    else if (e.name === "route.ts") results.push(full);
  }
  return results;
}

const AUDIT_EXCEPTIONS = [
  "health", "inngest", "auth", "user/companies",
  "dashboard", "alerts", "reports", "autocomplete",
  "bexio/accounts", "bexio/test", "bexio/settings",
  "documents/route.ts",
  "documents/[id]/file", "documents/[id]/audit",
  "documents/[id]/neighbors", "documents/[id]/similar",
  "documents/download-zip", "documents/reset-stuck",
  "messages", "periods/route.ts", "periods/[id]/detail",
  "company/route.ts", "trustee",
  "expected-documents/check", "rules/suggestions",
  "suppliers/autocomplete",
];

describe("Audit-Logging Coverage", () => {
  it("kritische Entity-Routes haben logAudit", () => {
    const apiDir = path.resolve("src/app/api");
    const routes = getAllRouteFiles(apiDir);
    const missing: string[] = [];

    for (const route of routes) {
      const rel = path.relative(apiDir, route).replace(/\\/g, "/");
      if (AUDIT_EXCEPTIONS.some((ex) => rel.includes(ex))) continue;

      const content = fs.readFileSync(route, "utf-8");
      const hasWrite =
        content.includes("export async function POST") ||
        content.includes("export async function PATCH") ||
        content.includes("export async function DELETE");

      if (hasWrite && !content.includes("logAudit")) {
        missing.push(rel);
      }
    }

    // Critical routes MUST have audit logging
    const criticalMissing = missing.filter(
      (r) =>
        r.includes("rules/") ||
        r.includes("knowledge/") ||
        r.includes("contracts/") ||
        r.includes("escalation") ||
        r.includes("approve") ||
        r.includes("reject")
    );
    expect(criticalMissing).toEqual([]);
  });

  it("audit-service exportiert logAudit und computeChanges", () => {
    const content = fs.readFileSync(
      path.resolve("src/lib/services/audit/audit-service.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function logAudit");
    expect(content).toContain("export function computeChanges");
  });
});
