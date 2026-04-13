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
  "email/webhook",       // Inbound webhook with own auth (secret header)
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

/**
 * Phase 8.9.2 — Security Audit für neue Phase-8 API-Endpoints.
 *
 * Stellt sicher, dass die in Phase 8 hinzugefügten Routes:
 * 1. getActiveCompany() für Auth aufrufen (→ 401 ohne Auth)
 * 2. companyId-Filter in Prisma-Queries verwenden (Mandantentrennung)
 * 3. Wo nötig, Rollen-/Permission-Checks durchführen (→ 403 bei falscher Rolle)
 */
describe("Phase-8 API Security Audit", () => {
  const apiDir = path.resolve("src/app/api");

  // Alle in Phase 8 hinzugefügten Endpoints
  const PHASE_8_ENDPOINTS: { path: string; needsRoleCheck?: boolean; method?: string }[] = [
    { path: "telemetry/route.ts" },
    { path: "telemetry/feedback/route.ts", needsRoleCheck: true, method: "POST" },
    { path: "autopilot/config/route.ts", needsRoleCheck: true, method: "PATCH" },
    { path: "autopilot/kill-switch/route.ts", needsRoleCheck: true, method: "POST" },
    { path: "corrections/patterns/route.ts" },
    { path: "corrections/patterns/[id]/promote/route.ts", needsRoleCheck: true, method: "POST" },
    { path: "next-actions/route.ts" },
    { path: "search/route.ts" },
    { path: "documents/[id]/decision-replay/route.ts" },
    { path: "suppliers/[id]/intelligence/route.ts" },
    { path: "rules/[id]/impact/route.ts" },
    { path: "knowledge/[id]/usage/route.ts" },
  ];

  function readEndpoint(relPath: string): string | null {
    const full = path.join(apiDir, relPath);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, "utf-8");
  }

  it("alle Phase-8 Routes existieren", () => {
    const missing: string[] = [];
    for (const ep of PHASE_8_ENDPOINTS) {
      if (!readEndpoint(ep.path)) missing.push(ep.path);
    }
    expect(missing).toEqual([]);
  });

  it("alle Phase-8 Routes prüfen Auth via getActiveCompany() und liefern 401 ohne Auth", () => {
    const violations: string[] = [];
    for (const ep of PHASE_8_ENDPOINTS) {
      const content = readEndpoint(ep.path);
      if (!content) continue;

      if (!content.includes("getActiveCompany")) {
        violations.push(`${ep.path} — kein getActiveCompany()`);
        continue;
      }

      // Muss 401 zurückgeben, wenn ctx fehlt
      const has401 = /401/.test(content) && /Nicht autorisiert/i.test(content);
      if (!has401) {
        violations.push(`${ep.path} — kein 401 mit "Nicht autorisiert"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("alle Phase-8 Routes filtern Daten per companyId (Mandantentrennung)", () => {
    const violations: string[] = [];
    for (const ep of PHASE_8_ENDPOINTS) {
      const content = readEndpoint(ep.path);
      if (!content) continue;

      // Route muss companyId aus dem Context verwenden
      const usesCompanyId =
        content.includes("ctx.companyId") ||
        content.includes("companyId: ctx.") ||
        content.includes("companyId: companyId") ||
        /const\s*\{\s*companyId\b[^}]*\}\s*=\s*ctx\b/.test(content);

      if (!usesCompanyId) {
        violations.push(`${ep.path} — verwendet companyId nicht aus Context`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("schreibende Phase-8 Routes prüfen Rolle/Permission und liefern 403 bei falscher Rolle", () => {
    const violations: string[] = [];
    for (const ep of PHASE_8_ENDPOINTS) {
      if (!ep.needsRoleCheck) continue;
      const content = readEndpoint(ep.path);
      if (!content) continue;

      const hasPermissionCheck =
        content.includes("hasPermission") ||
        content.includes('"admin"') ||
        content.includes('"trustee"') ||
        content.includes('"reviewer"');

      if (!hasPermissionCheck) {
        violations.push(`${ep.path} — keine Rollen-/Permission-Prüfung`);
      }

      const has403 = /403/.test(content) && /Keine Berechtigung/i.test(content);
      if (!has403) {
        violations.push(`${ep.path} — kein 403 mit "Keine Berechtigung"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("kritische Phase-8 Routes verwenden hasPermission aus permissions.ts", () => {
    const PERMISSION_ROUTES = [
      "autopilot/config/route.ts",
      "autopilot/kill-switch/route.ts",
      "corrections/patterns/[id]/promote/route.ts",
      "documents/bulk-approve/route.ts",
      "documents/bulk-reject/route.ts",
      "telemetry/feedback/route.ts",
      "onboarding/unknowns/route.ts",
      "onboarding/golive/route.ts",
    ];
    const violations: string[] = [];
    for (const route of PERMISSION_ROUTES) {
      const content = readEndpoint(route);
      if (!content) {
        violations.push(`${route} — Datei nicht gefunden`);
        continue;
      }
      if (!content.includes("hasPermission")) {
        violations.push(`${route} — kein hasPermission()-Aufruf`);
      }
      if (!content.includes("@/lib/permissions")) {
        violations.push(`${route} — kein Import aus @/lib/permissions`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("Phase-8 Routes referenzieren companyId im File (Mandanten-Schutz)", () => {
    const violations: string[] = [];
    for (const ep of PHASE_8_ENDPOINTS) {
      const content = readEndpoint(ep.path);
      if (!content) continue;

      // Mindestens eine Referenz auf companyId muss vorhanden sein
      if (!content.includes("companyId")) {
        violations.push(`${ep.path} — keine companyId-Referenz`);
      }
    }
    expect(violations).toEqual([]);
  });
});
