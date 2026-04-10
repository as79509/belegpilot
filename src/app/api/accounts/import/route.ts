import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";

const BCLASS_TO_TYPE: Record<number, string> = {
  1: "asset",
  2: "liability",
  3: "expense",
  4: "revenue",
};

const ACCOUNT_HEADER_ALIASES: Record<string, string> = {
  account: "accountNumber",
  accountnumber: "accountNumber",
  konto: "accountNumber",
  description: "name",
  name: "name",
  bezeichnung: "name",
  bclass: "bclass",
  gr: "groupCode",
};

function detectSeparator(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) return "\t";
  if (semiCount >= commaCount && semiCount > 0) return ";";
  return ",";
}

function parseHeaderMapping(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].trim().toLowerCase().replace(/[^a-z]/g, "");
    const field = ACCOUNT_HEADER_ALIASES[normalized];
    if (field) mapping[i] = field;
  }
  return mapping;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Bitte eine Datei auswählen" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "Datei enthält keine Daten" }, { status: 400 });
    }

    const separator = detectSeparator(lines[0]);
    const headers = lines[0].split(separator);
    const mapping = parseHeaderMapping(headers);

    if (!Object.values(mapping).includes("accountNumber")) {
      return NextResponse.json({ error: "Spalte 'Konto' oder 'Account' nicht gefunden" }, { status: 400 });
    }
    if (!Object.values(mapping).includes("name")) {
      return NextResponse.json({ error: "Spalte 'Bezeichnung' oder 'Description' nicht gefunden" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    const errors: Array<{ line: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator);
      const row: Record<string, string> = {};
      for (const [idx, field] of Object.entries(mapping)) {
        row[field] = (cols[Number(idx)] ?? "").trim();
      }

      const accountNumber = row.accountNumber;
      const name = row.name;

      if (!accountNumber) {
        errors.push({ line: i + 1, error: "Kontonummer fehlt" });
        continue;
      }
      if (!name) {
        errors.push({ line: i + 1, error: "Bezeichnung fehlt" });
        continue;
      }

      const bclass = row.bclass ? parseInt(row.bclass, 10) : null;
      const accountType = bclass && BCLASS_TO_TYPE[bclass]
        ? BCLASS_TO_TYPE[bclass]
        : "expense"; // Default
      const groupCode = row.groupCode || null;

      // AI Governance default: manual_only for asset/liability, ai_suggest for expense/revenue
      const aiGovernance = (accountType === "asset" || accountType === "liability")
        ? "manual_only"
        : "ai_suggest";

      try {
        const existing = await prisma.account.findUnique({
          where: { companyId_accountNumber: { companyId: ctx.companyId, accountNumber } },
        });

        if (existing) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              name,
              accountType,
              bclass,
              groupCode,
            },
          });
          updated++;
        } else {
          await prisma.account.create({
            data: {
              companyId: ctx.companyId,
              accountNumber,
              name,
              accountType,
              bclass,
              groupCode,
              aiGovernance,
            },
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ line: i + 1, error: err.message });
      }
    }

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "accounts_imported",
      entityType: "account",
      entityId: ctx.companyId,
      changes: { created: { before: 0, after: created }, updated: { before: 0, after: updated } },
    });

    return NextResponse.json({ created, updated, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
