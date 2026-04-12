import { describe, it, expect } from "vitest";
import * as fs from "fs";

function read(path: string): string {
  return fs.readFileSync(path, "utf-8");
}

describe("Role Reality Audit", () => {
  describe("Sidebar", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");

    it("hat Viewer-spezifische clientGroup", () => {
      expect(sidebar).toContain("isViewer");
      expect(sidebar).toContain("clientGroup");
    });

    it("clientGroup enthält Dokumente und Aufgaben", () => {
      // Extract clientGroup block and check for /documents and /tasks
      const clientGroupIdx = sidebar.indexOf("const clientGroup");
      const clientGroupBlock = sidebar.slice(clientGroupIdx, clientGroupIdx + 400);
      expect(clientGroupBlock).toContain("/documents");
      expect(clientGroupBlock).toContain("/tasks");
    });

    it("versteckt System-Gruppe für Reviewer", () => {
      expect(sidebar).toContain("isReviewer");
      // systemGroup is only added when !isReviewer
      expect(sidebar).toContain("!isReviewer");
      expect(sidebar).toContain("systemGroup");
    });

    it("zeigt Treuhänder-Gruppe nur für Admin/Trustee mit Multi-Company", () => {
      expect(sidebar).toContain("isAdminOrTrustee");
      expect(sidebar).toContain("trusteeGroup");
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
      expect(dashboard).toContain("Hochgeladen");
    });
  });

  describe("DocumentTable", () => {
    const docTable = read("src/components/documents/document-table.tsx");

    it("prüft canMutate vor Approve/Reject Buttons", () => {
      expect(docTable).toContain("canMutate");
    });

    it("erlaubt Trustee-Rolle Mutationen", () => {
      // The canMutate line should include trustee
      const canMutateLine = docTable.split("\n").find(l => l.includes("canMutate") && l.includes("="));
      expect(canMutateLine).toBeDefined();
      expect(canMutateLine).toContain("trustee");
    });

    it("Viewer hat keine Mutations-Berechtigung", () => {
      const canMutateLine = docTable.split("\n").find(l => l.includes("canMutate") && l.includes("="));
      expect(canMutateLine).toBeDefined();
      // "viewer" standalone (not as substring of "reviewer")
      expect(canMutateLine).not.toMatch(/"viewer"/);
      expect(canMutateLine).not.toMatch(/"readonly"/);
    });
  });
});
