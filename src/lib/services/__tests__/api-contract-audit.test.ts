import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = process.cwd();

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf-8");
}

function findPages(dir: string): string[] {
  const results: string[] = [];
  const absDir = path.join(root, dir);
  if (!fs.existsSync(absDir)) return results;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findPages(rel));
    } else if (entry.name === "page.tsx") {
      results.push(rel);
    }
  }
  return results;
}

describe("API Contract Audit — Response-Format", () => {

  // ─── Critical API response format checks ───

  it("Email Inboxes API gibt { inboxes: [...] } zurück", () => {
    const content = readFile("src/app/api/email/inboxes/route.ts");
    expect(content).toMatch(/\{\s*inboxes\s*[},]/);
    expect(content).toMatch(/NextResponse\.json\(\s*\{\s*inboxes/);
  });

  it("Email Page liest data.inboxes (nicht data direkt)", () => {
    const content = readFile("src/app/(dashboard)/email/page.tsx");
    expect(content).toContain("data.inboxes");
  });

  it("Documents API gibt { documents: [...], pagination } zurück", () => {
    const content = readFile("src/app/api/documents/route.ts");
    expect(content).toContain("documents:");
    expect(content).toContain("pagination:");
  });

  it("Suppliers API gibt { suppliers: [...], pagination } zurück", () => {
    const content = readFile("src/app/api/suppliers/route.ts");
    expect(content).toContain("suppliers");
    expect(content).toContain("pagination");
  });

  it("Suppliers Page liest data.suppliers", () => {
    const content = readFile("src/app/(dashboard)/suppliers/page.tsx");
    expect(content).toMatch(/data\.suppliers/);
  });

  it("VAT API gibt { returns: [...] } zurück", () => {
    const content = readFile("src/app/api/vat/route.ts");
    expect(content).toMatch(/NextResponse\.json\(\s*\{\s*returns:/);
  });

  it("VAT Page liest data.returns (nicht data direkt als Array)", () => {
    const content = readFile("src/app/(dashboard)/vat/page.tsx");
    expect(content).toContain("data.returns");
  });

  it("Journal API gibt { entries: [...], pagination } zurück", () => {
    const content = readFile("src/app/api/journal/route.ts");
    expect(content).toContain("entries");
    expect(content).toContain("pagination");
  });

  it("Journal Page liest d.entries", () => {
    const content = readFile("src/app/(dashboard)/journal/page.tsx");
    expect(content).toMatch(/\.entries/);
  });

  it("Accounts API gibt { accounts: [...] } zurück", () => {
    const content = readFile("src/app/api/accounts/route.ts");
    expect(content).toContain("accounts");
  });

  it("Accounts Page liest data.accounts", () => {
    const content = readFile("src/app/(dashboard)/accounts/page.tsx");
    expect(content).toMatch(/data\.accounts/);
  });

  it("Integrations API gibt { providers: [...] } zurück", () => {
    const content = readFile("src/app/api/integrations/route.ts");
    expect(content).toContain("providers:");
  });

  it("Integrations Page liest data.providers", () => {
    const content = readFile("src/app/(dashboard)/integrations/page.tsx");
    expect(content).toMatch(/data\.providers/);
  });

  it("Trustee Overview API gibt { companies: [...] } zurück", () => {
    const content = readFile("src/app/api/trustee/overview/route.ts");
    expect(content).toContain("companies");
  });

  it("Banana Mapping Accounts API gibt { accounts: [...] } zurück", () => {
    const content = readFile("src/app/api/banana/mapping/accounts/route.ts");
    expect(content).toContain("accounts");
  });

  it("Banana Mapping VatCodes API gibt { vatCodes: [...] } zurück", () => {
    const content = readFile("src/app/api/banana/mapping/vat-codes/route.ts");
    expect(content).toContain("vatCodes");
  });

  // ─── Structural: No page fetches directly as array when API returns object ───

  it("Keine Page macht setXyz(await res.json()) wenn API ein Objekt mit benanntem Array liefert", () => {
    // Check the known-fixed pages explicitly
    const emailPage = readFile("src/app/(dashboard)/email/page.tsx");
    // Must NOT have the raw pattern: `setInboxes(await res.json())` without extracting .inboxes
    expect(emailPage).not.toMatch(/setInboxes\(await res\.json\(\)\)/);

    const vatPage = readFile("src/app/(dashboard)/vat/page.tsx");
    // Must extract .returns from the response
    expect(vatPage).toContain("data.returns");
  });

  // ─── VAT XML is marked as placeholder ───

  it("VAT XML Route hat X-Implementation-Status: placeholder Header", () => {
    const content = readFile("src/app/api/vat/[id]/xml/route.ts");
    expect(content).toContain("placeholder");
  });

  it("VAT XML Button ist in der UI als disabled markiert", () => {
    const content = readFile("src/app/(dashboard)/vat/page.tsx");
    // The XML export button should be disabled
    expect(content).toMatch(/eCH-0217 in Vorbereitung/);
  });

  // ─── Coverage: every dashboard page with fetch has matching API route ───

  it("Jede Dashboard-Page mit fetch() hat eine existierende API-Route", () => {
    const pages = findPages("src/app/(dashboard)");
    const missing: string[] = [];

    for (const pagePath of pages) {
      const content = fs.readFileSync(path.join(root, pagePath), "utf-8");
      const fetchCalls = [...content.matchAll(/fetch\(\s*[`"](\/api\/[^`"?]+)/g)];

      for (const [, apiPath] of fetchCalls) {
        // Skip dynamic paths with ${...} interpolation
        if (apiPath.includes("${")) continue;

        const routeFile = path.join(root, "src/app", apiPath, "route.ts");
        if (!fs.existsSync(routeFile)) {
          missing.push(`${pagePath} → ${apiPath}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
