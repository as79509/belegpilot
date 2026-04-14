import { describe, it, expect } from "vitest";
import * as fs from "fs";

function read(path: string): string {
  return fs.readFileSync(path, "utf-8");
}

describe("Role Reality Audit", () => {
  describe("Sidebar", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");

    it("hat rollenbasierte Navigation mit viewer/trustee/admin", () => {
      expect(sidebar).toContain("viewer");
      expect(sidebar).toContain("trustee");
      expect(sidebar).toContain("admin");
      expect(sidebar).toContain("getNavRole");
    });

    it("Viewer sieht flache Liste mit Dokumenten und Aufgaben", () => {
      const viewerIdx = sidebar.indexOf("viewerItems");
      const viewerBlock = sidebar.slice(viewerIdx, viewerIdx + 500);
      expect(viewerBlock).toContain("/documents");
      expect(viewerBlock).toContain("/tasks");
    });

    it("Trustee hat gruppierte Navigation", () => {
      expect(sidebar).toContain("buildTrusteeGroups");
      expect(sidebar).toContain("Tagesarbeit");
      expect(sidebar).toContain("Finanzen");
    });

    it("Admin hat zusätzliche Administration-Gruppe", () => {
      expect(sidebar).toContain("adminGroup");
      expect(sidebar).toContain("Administration");
    });
  });

  describe("Dashboard", () => {
    const dashboard = read("src/app/(dashboard)/dashboard/page.tsx");

    it("hat rollenspezifische Viewer-Ansicht", () => {
      expect(dashboard).toContain("isViewer");
    });

    it("leitet Viewer NICHT auf /client um", () => {
      expect(dashboard).not.toContain('router.replace("/client")');
    });

    it("zeigt Viewer ein vereinfachtes Dashboard", () => {
      expect(dashboard).toContain("de.dashboard.uploadReadOnlyTitle");
      expect(dashboard).toContain("de.dashboard.tasksOpen");
      expect(dashboard).toContain("de.dashboard.processedDocuments");
    });
  });

  describe("DocumentTable", () => {
    const docTable = read("src/components/documents/document-table.tsx");

    it("prüft canMutate vor Approve/Reject Buttons", () => {
      expect(docTable).toContain("canMutate");
    });

    it("erlaubt Trustee-Rolle Mutationen", () => {
      expect(docTable).toContain('hasPermission(role, "documents:write")');
      expect(docTable).toContain("const canEdit");
      expect(docTable).toContain("canMutate={canEdit}");
    });

    it("Viewer hat keine Mutations-Berechtigung", () => {
      expect(docTable).toContain('const canEdit = hasPermission(role, "documents:write")');
      expect(docTable).not.toContain('role === "viewer"');
      expect(docTable).not.toContain('role === "readonly"');
    });
  });
});
