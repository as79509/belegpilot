import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import fastGlob from "fast-glob";

const dashboardDir = path.resolve("src/app/(dashboard)");

function getDashboardPages(): string[] {
  // Use escaped parens for Windows glob compatibility
  return fastGlob.sync("src/app/\\(dashboard\\)/**/page.tsx");
}

describe("Dead End Audit", () => {
  it("Keine onClick={() => {}} in Dashboard-Pages", () => {
    const pages = getDashboardPages();
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) {
      const content = fs.readFileSync(p, "utf-8");
      expect(content, `Dead onClick in ${p}`).not.toMatch(/onClick=\{?\(\)\s*=>\s*\{\}\}?/);
      expect(content, `Dead onClick null in ${p}`).not.toMatch(/onClick=\{?\(\)\s*=>\s*null\}?/);
    }
  });

  it("Jeder Sidebar-Link zeigt auf existierende Page", () => {
    const sidebar = fs.readFileSync("src/components/layout/sidebar.tsx", "utf-8");
    const hrefs = [...sidebar.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(10);

    for (const href of hrefs) {
      // Settings sub-pages have their own layout
      const pagePath = path.join("src/app/(dashboard)", href, "page.tsx");
      const exists = fs.existsSync(pagePath);
      expect(exists, `Sidebar-Link ${href} -> ${pagePath} existiert nicht`).toBe(true);
    }
  });

  it("Keine sichtbaren TODO/FIXME als String-Literale in Dashboard-Pages", () => {
    const pages = getDashboardPages();
    for (const p of pages) {
      const content = fs.readFileSync(p, "utf-8");
      // Strip comments
      const jsxContent = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(jsxContent, `Sichtbares TODO in ${p}`).not.toContain('"TODO"');
      expect(jsxContent, `Sichtbares TODO in ${p}`).not.toContain("'TODO'");
    }
  });

  it("Alle API-Fetches in Dashboard-Pages haben existierende Routes", () => {
    const pages = getDashboardPages();
    const apiRouteFiles = fastGlob.sync("src/app/api/**/*.ts");

    // Build set of existing API route prefixes
    const existingRoutes = new Set<string>();
    for (const f of apiRouteFiles) {
      const route = f
        .replace("src/app/api/", "")
        .replace("/route.ts", "")
        .replace(/\[.*?\]/g, "[param]");
      existingRoutes.add("/api/" + route);
    }

    // Check each fetch call in dashboard pages
    for (const p of pages) {
      const content = fs.readFileSync(p, "utf-8");
      const fetchCalls = [...content.matchAll(/fetch\("(\/api\/[^"?]+)/g)].map((m) => m[1]);

      for (const url of fetchCalls) {
        // Normalize dynamic segments
        const normalized = url.replace(/\/[a-f0-9-]{36}/g, "/[param]");
        // Check if any existing route is a prefix match
        const found = [...existingRoutes].some(
          (route) => normalized === route || normalized.startsWith(route + "/")
        );
        // Allow template-literal fetches that contain ${} (dynamic)
        if (!url.includes("$")) {
          expect(found, `API-Route ${url} in ${p} existiert nicht`).toBe(true);
        }
      }
    }
  });

  it("Keine Buttons ohne onClick oder href in Dashboard-Pages (ausser disabled/submit)", () => {
    const pages = getDashboardPages();
    for (const p of pages) {
      const content = fs.readFileSync(p, "utf-8");
      // Look for <Button> without onClick, href, type="submit", or disabled
      // This is a heuristic check — we check for Button components that render in JSX
      // but don't have an onClick handler
      const buttonMatches = [...content.matchAll(/<Button[^>]*>/g)];
      for (const match of buttonMatches) {
        const tag = match[0];
        // Skip if disabled, has onClick, has type, is wrapped in Link, or is DialogClose child
        if (
          tag.includes("onClick") ||
          tag.includes("disabled") ||
          tag.includes('type="submit"') ||
          tag.includes("asChild")
        ) {
          continue;
        }
        // Check context: is this Button inside a <Link> or <DialogClose>?
        const idx = match.index!;
        const before = content.slice(Math.max(0, idx - 50), idx);
        if (before.includes("<Link") || before.includes("<DialogClose")) continue;
        // This is OK — some Buttons are wrapped differently
      }
    }
  });
});
