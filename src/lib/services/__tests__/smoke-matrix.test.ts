import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("Smoke Matrix Coverage", () => {
  it("Smoke Matrix existiert und ist aktuell", () => {
    expect(fs.existsSync("docs/smoke-matrix.md")).toBe(true);
    const content = fs.readFileSync("docs/smoke-matrix.md", "utf-8");
    expect(content).toContain("2026-04");
    // Mindestens 25 Funktionen geprueft
    const checkmarks = (content.match(/✅|⚠️|❌|🔲/g) || []).length;
    expect(checkmarks).toBeGreaterThanOrEqual(25);
  });

  it("Keine Kernfunktion (1-10) ist blockiert", () => {
    const content = fs.readFileSync("docs/smoke-matrix.md", "utf-8");
    const lines = content.split("\n");
    const coreLines = lines.filter(
      (l) => l.match(/^\|\s*[1-9]\s*\|/) || l.match(/^\|\s*10\s*\|/)
    );
    expect(coreLines.length).toBeGreaterThanOrEqual(10);
    for (const line of coreLines) {
      expect(line, "Kernfunktion blockiert: " + line.slice(0, 80)).not.toContain(
        "\u274C"
      );
    }
  });

  it("Known Issues Sektion existiert", () => {
    const content = fs.readFileSync("docs/smoke-matrix.md", "utf-8");
    expect(content).toContain("Known Issues");
    expect(content).toContain("Schwere");
    expect(content).toContain("Fix-Aufwand");
  });

  it("Zusammenfassung zeigt Gesamtbild", () => {
    const content = fs.readFileSync("docs/smoke-matrix.md", "utf-8");
    expect(content).toContain("Zusammenfassung");
    expect(content).toMatch(/Funktioniert.*\d+/);
  });
});
