import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function getAllRouteFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllRouteFiles(fullPath));
    else if (entry.name === "route.ts") results.push(fullPath);
  }
  return results;
}

const EXCEPTIONS = [
  "health",
  "inngest",
  "auth/[...nextauth]",
  "trustee/queue",       // Cross-company query by design
  "user/companies",      // Lists all user companies by design
];

describe("Multi-Tenant Security Audit", () => {
  it("alle API-Routes nutzen getActiveCompany() oder sind Ausnahmen", () => {
    const apiDir = path.resolve("src/app/api");
    const routes = getAllRouteFiles(apiDir);
    const violations: string[] = [];

    for (const route of routes) {
      const relativePath = path.relative(apiDir, route).replace(/\\/g, "/");
      if (EXCEPTIONS.some((ex) => relativePath.includes(ex))) continue;

      const content = fs.readFileSync(route, "utf-8");

      const hasGetActiveCompany = content.includes("getActiveCompany");
      const hasAuth = content.includes('from "@/lib/auth"');

      if (!hasGetActiveCompany && !hasAuth) {
        violations.push(relativePath + " — keine Auth/Company-Prüfung");
      }

      // Direct session.user.companyId without getActiveCompany is a security risk
      if (content.includes("session.user.companyId") && !hasGetActiveCompany) {
        violations.push(relativePath + " — nutzt session.user.companyId direkt statt getActiveCompany()");
      }
    }

    if (violations.length > 0) {
      console.warn("Security violations found:", violations);
    }
    expect(violations).toEqual([]);
  });

  it("keine Route hat leere catch-Blöcke", () => {
    const apiDir = path.resolve("src/app/api");
    const routes = getAllRouteFiles(apiDir);
    const violations: string[] = [];

    for (const route of routes) {
      const content = fs.readFileSync(route, "utf-8");
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
        violations.push(path.relative(apiDir, route).replace(/\\/g, "/"));
      }
    }

    expect(violations).toEqual([]);
  });

  it("getActiveCompany prüft Cookie + UserCompany Zugriff", () => {
    const content = fs.readFileSync(path.resolve("src/lib/get-active-company.ts"), "utf-8");
    expect(content).toContain("userCompany");
    expect(content).toContain("cookie");
  });

  it("alle Routes die Daten schreiben haben Error-Handling", () => {
    const apiDir = path.resolve("src/app/api");
    const routes = getAllRouteFiles(apiDir);
    const violations: string[] = [];

    for (const route of routes) {
      const relativePath = path.relative(apiDir, route).replace(/\\/g, "/");
      if (EXCEPTIONS.some((ex) => relativePath.includes(ex))) continue;

      const content = fs.readFileSync(route, "utf-8");
      const hasMutation = content.includes("export async function POST") || content.includes("export async function PATCH") || content.includes("export async function DELETE");
      if (!hasMutation) continue;

      const hasErrorHandling = content.includes("catch") || content.includes("status: 4") || content.includes("status: 5");
      if (!hasErrorHandling) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
