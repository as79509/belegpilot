import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiDir = path.resolve("src/app/api");

function readRoute(relativePath: string): string | null {
  const fullPath = path.join(apiDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf-8");
}

describe("Rollen-Berechtigungen", () => {
  const ADMIN_ONLY_ROUTES = [
    "rules/route.ts",
    "rules/[id]/route.ts",
    "rules/quick/route.ts",
    "rules/templates/route.ts",
  ];

  const ADMIN_TRUSTEE_ROUTES = [
    "knowledge/route.ts",
    "escalation-rules/route.ts",
    "escalation-rules/defaults/route.ts",
    "expected-documents/route.ts",
  ];

  const REVIEWER_ROUTES = [
    "documents/[id]/approve/route.ts",
    "documents/[id]/reject/route.ts",
    "documents/bulk-approve/route.ts",
    "documents/[id]/route.ts",
  ];

  it("admin-only POST/PATCH/DELETE Routes prüfen admin Rolle", () => {
    for (const route of ADMIN_ONLY_ROUTES) {
      const content = readRoute(route);
      if (!content) continue;
      // POST/PATCH handlers should check admin role
      if (content.includes("POST") || content.includes("PATCH") || content.includes("DELETE")) {
        const hasAdminCheck = content.includes('"admin"');
        expect(hasAdminCheck, `${route} should check admin role`).toBe(true);
      }
    }
  });

  it("admin/trustee Routes prüfen admin oder trustee Rolle", () => {
    for (const route of ADMIN_TRUSTEE_ROUTES) {
      const content = readRoute(route);
      if (!content) continue;
      if (content.includes("POST") || content.includes("PATCH") || content.includes("DELETE")) {
        const hasRoleCheck = content.includes('"admin"') || content.includes('"trustee"');
        expect(hasRoleCheck, `${route} should check admin/trustee role`).toBe(true);
      }
    }
  });

  it("reviewer Routes prüfen admin oder reviewer Rolle", () => {
    for (const route of REVIEWER_ROUTES) {
      const content = readRoute(route);
      if (!content) continue;
      const hasRoleCheck = content.includes('"admin"') || content.includes('"reviewer"');
      expect(hasRoleCheck, `${route} should check admin/reviewer role`).toBe(true);
    }
  });

  it("period lock/unlock nur admin/trustee", () => {
    const content = readRoute("periods/[id]/route.ts");
    expect(content).not.toBeNull();
    expect(content).toContain('"admin"');
    expect(content).toContain('"trustee"');
  });

  it("readonly Rolle hat keinen Schreibzugriff auf sensible Routes", () => {
    // Readonly should never appear in role check arrays that allow writes
    const sensitiveRoutes = [
      "documents/[id]/approve/route.ts",
      "rules/route.ts",
      "knowledge/route.ts",
    ];
    for (const route of sensitiveRoutes) {
      const content = readRoute(route);
      if (!content) continue;
      // "readonly" should NOT be in any includes() role check
      const hasReadonlyWrite = content.includes('"readonly"') &&
        (content.includes("POST") || content.includes("PATCH") || content.includes("DELETE"));
      // It's OK if readonly is mentioned in a GET handler, but not in write handlers
      // For safety, just verify it's not in the role check arrays
      const roleCheckPattern = /includes\(.*"readonly".*\)/;
      expect(roleCheckPattern.test(content || ""), `${route} should not allow readonly role for writes`).toBe(false);
    }
  });
});
