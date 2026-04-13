import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Produktabnahme Phase 11X", () => {
  // ── Ist es schön? ──
  describe("Visuelle Konsistenz", () => {
    it("Design-Tokens existieren und werden genutzt", () => {
      const tokens = fs.readFileSync("src/lib/design-tokens.ts", "utf-8");
      expect(tokens).toContain("colors");
      expect(tokens).toContain("typography");
      expect(tokens).toContain("spacing");
    });

    it("Mindestens 5 DS-Komponenten importieren Design-Tokens", () => {
      const dsDir = "src/components/ds";
      const files = fs.readdirSync(dsDir).filter(f => f.endsWith(".tsx"));
      let tokenUsers = 0;
      for (const f of files) {
        const c = fs.readFileSync(path.join(dsDir, f), "utf-8");
        if (c.includes("design-tokens")) tokenUsers++;
      }
      expect(tokenUsers).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Ist es klar? ──
  describe("Navigation & Rollen", () => {
    it("Sidebar hat rollenbasierte Navigation", () => {
      const c = fs.readFileSync("src/components/layout/sidebar.tsx", "utf-8");
      expect(c).toContain("viewer");
      expect(c).toContain("trustee");
      expect(c).toContain("admin");
    });

    it("Breadcrumb-Komponente existiert", () => {
      expect(fs.existsSync("src/components/layout/breadcrumb.tsx")).toBe(true);
    });

    it("useRole Hook existiert", () => {
      const c = fs.readFileSync("src/lib/hooks/use-role.ts", "utf-8");
      expect(c).toContain("useRole");
    });
  });

  // ── Ist es schnell? ──
  describe("Performance & Feedback", () => {
    it("Page-Skeletons für alle Hauptseiten-Typen", () => {
      const c = fs.readFileSync("src/components/ds/page-skeleton.tsx", "utf-8");
      expect(c).toContain("DashboardSkeleton");
      expect(c).toContain("TablePageSkeleton");
      expect(c).toContain("DetailPageSkeleton");
      expect(c).toContain("WizardSkeleton");
    });

    it("SaveIndicator für Formular-Feedback", () => {
      const c = fs.readFileSync("src/components/ds/save-indicator.tsx", "utf-8");
      expect(c).toContain("SaveIndicator");
      expect(c).toContain("useSaveState");
    });

    it("Interaction-Classes für konsistente Hover/Focus", () => {
      const c = fs.readFileSync("src/lib/interaction-classes.ts", "utf-8");
      expect(c).toContain("interact");
    });
  });

  // ── Ist es vertrauenswürdig? ──
  describe("Trust Layer", () => {
    it("TrustSignal Komponente existiert", () => {
      expect(fs.existsSync("src/components/ds/trust-signal.tsx")).toBe(true);
    });

    it("ProtectionBadge Komponente existiert", () => {
      expect(fs.existsSync("src/components/ds/protection-badge.tsx")).toBe(true);
    });
  });

  // ── Ist es verständlich? ──
  describe("Text & Empty States", () => {
    it("emptyStates Block in de.ts", () => {
      const c = fs.readFileSync("src/lib/i18n/de.ts", "utf-8");
      expect(c).toContain("emptyStates");
    });

    it("FirstUseHint existiert", () => {
      expect(fs.existsSync("src/components/ds/first-use-hint.tsx")).toBe(true);
    });

    it("Mindestens 5 Seiten nutzen EmptyState", () => {
      const pages = ["suppliers", "rules", "journal", "tasks", "contracts", "expected-documents", "bank"];
      let count = 0;
      for (const p of pages) {
        const filePath = `src/app/(dashboard)/${p}/page.tsx`;
        if (fs.existsSync(filePath)) {
          const c = fs.readFileSync(filePath, "utf-8");
          if (c.includes("EmptyState") || c.includes("emptyStates")) count++;
        }
      }
      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Ist es effizient? ──
  describe("Review-Effizienz", () => {
    it("Keyboard-Shortcuts für Review", () => {
      expect(fs.existsSync("src/lib/hooks/use-review-shortcuts.ts")).toBe(true);
    });

    it("Document-Detail hat Queue-Navigation", () => {
      const c = fs.readFileSync("src/app/(dashboard)/documents/[id]/page.tsx", "utf-8");
      expect(c).toContain("reviewQueue");
    });
  });

  // ── Projekt-Integrität ──
  describe("Projekt-Integrität", () => {
    it("README erwähnt Phase 11 und Phase 11X", () => {
      const c = fs.readFileSync("README.md", "utf-8");
      expect(c).toContain("Phase 11");
      expect(c).toContain("Phase 11X");
    });

    it("CLAUDE.md erwähnt Phase 11X", () => {
      const c = fs.readFileSync("CLAUDE.md", "utf-8");
      expect(c).toContain("11X");
    });

    it("Alle DS-Komponenten sind exportiert", () => {
      const c = fs.readFileSync("src/components/ds/index.ts", "utf-8");
      expect(c).toContain("TrustSignal");
      expect(c).toContain("ProtectionBadge");
      expect(c).toContain("FirstUseHint");
      expect(c).toContain("SaveIndicator");
      expect(c).toContain("DashboardSkeleton");
    });
  });
});
