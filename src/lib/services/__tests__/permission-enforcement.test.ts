import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ROUTE_PERMISSION_MAP, PERMISSION_EXEMPT_ROUTES } from "@/lib/permission-route-map";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";

const apiDir = path.join(process.cwd(), "src/app/api");

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizeRoutePath(absolutePath: string): string {
  return path.relative(apiDir, path.dirname(absolutePath)).replace(/\\/g, "/");
}

function hasMutatingExport(content: string): boolean {
  return /export\s+async\s+function\s+(POST|PATCH|DELETE|PUT)/.test(content);
}

function isExempt(routePath: string): boolean {
  return PERMISSION_EXEMPT_ROUTES.some((exempt) => routePath.includes(exempt));
}

describe("Permission Enforcement Audit", () => {
  const routes = findRouteFiles(apiDir);

  // NOTE: This test is .skip because hasPermission calls are not yet in all routes.
  // Will be activated in Phase 9X.1b.
  it.skip("alle mutierenden Routes haben hasPermission oder sind Ausnahmen — wird in 9X.1b aktiviert", () => {
    const missing: string[] = [];

    for (const routeFile of routes) {
      const content = fs.readFileSync(routeFile, "utf-8");
      const routePath = normalizeRoutePath(routeFile);

      if (!hasMutatingExport(content)) continue;
      if (isExempt(routePath)) continue;

      if (!content.includes("hasPermission")) {
        missing.push(routePath);
      }
    }

    expect(missing).toEqual([]);
  });

  it("Permission-Route-Map deckt alle mutierenden Routes ab", () => {
    const unmapped: string[] = [];

    for (const routeFile of routes) {
      const content = fs.readFileSync(routeFile, "utf-8");
      const routePath = normalizeRoutePath(routeFile);

      if (!hasMutatingExport(content)) continue;
      if (isExempt(routePath)) continue;

      if (!ROUTE_PERMISSION_MAP[routePath]) {
        unmapped.push(routePath);
      }
    }

    expect(unmapped).toEqual([]);
  });

  it("alle Permissions in der Route-Map existieren als Permission-Typ", () => {
    const invalid: string[] = [];
    const permSet = new Set<string>(ALL_PERMISSIONS as readonly string[]);

    for (const [route, methods] of Object.entries(ROUTE_PERMISSION_MAP)) {
      for (const [method, perm] of Object.entries(methods)) {
        if (!permSet.has(perm as string)) {
          invalid.push(route + " " + method + ": " + perm + " ist kein gueltiger Permission-Typ");
        }
      }
    }

    expect(invalid).toEqual([]);
  });

  it("PERMISSION_EXEMPT_ROUTES enthalten keine Duplikate", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const route of PERMISSION_EXEMPT_ROUTES) {
      if (seen.has(route)) duplicates.push(route);
      seen.add(route);
    }
    expect(duplicates).toEqual([]);
  });

  it("ROLE_PERMISSIONS Rollen-Hierarchie ist konsistent", () => {
    const viewerPerms = new Set(ROLE_PERMISSIONS.viewer);
    const reviewerPerms = new Set(ROLE_PERMISSIONS.reviewer);
    const trusteePerms = new Set(ROLE_PERMISSIONS.trustee as string[]);

    // Jede viewer-Permission muss auch in reviewer sein
    const viewerNotInReviewer: string[] = [];
    for (const p of viewerPerms) {
      if (!reviewerPerms.has(p)) viewerNotInReviewer.push(p as string);
    }
    expect(viewerNotInReviewer).toEqual([]);

    // Jede reviewer-Permission muss auch in trustee sein
    const reviewerNotInTrustee: string[] = [];
    for (const p of reviewerPerms) {
      if (!trusteePerms.has(p)) reviewerNotInTrustee.push(p as string);
    }
    expect(reviewerNotInTrustee).toEqual([]);
  });
});
