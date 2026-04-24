import { pdf } from "pdf-to-img";

import { callAiJson, hasUsableAiConfig } from "@/lib/ai";
import type { LiteSettings, StructuredAccount } from "@/lib/types";
import { takeFirstLine } from "@/lib/utils";

function inferAccountKind(accountNo: string, name: string) {
  const lower = `${accountNo} ${name}`.toLowerCase();

  if (lower.includes("kreditor") || lower.includes("verbind")) return "creditor";
  if (lower.includes("bank") || lower.includes("kasse")) return "asset";
  if (lower.includes("umsatz") || lower.includes("erlös") || lower.includes("ertrag")) {
    return "revenue";
  }
  if (lower.includes("mwst") || lower.includes("steuer")) return "tax";

  if (/^[67]/.test(accountNo)) return "expense";
  if (/^[34]/.test(accountNo)) return "revenue";
  if (/^[12]/.test(accountNo)) return "asset";

  return "account";
}

function normalizeAccounts(accounts: StructuredAccount[]) {
  const seen = new Map<string, StructuredAccount>();

  for (const account of accounts) {
    const accountNo = account.accountNo.trim();
    const name = takeFirstLine(account.name);

    if (!accountNo || !name) continue;

    seen.set(accountNo, {
      accountNo,
      name,
      kind: account.kind || inferAccountKind(accountNo, name),
      isActive: account.isActive ?? true,
    });
  }

  return Array.from(seen.values()).sort((left, right) =>
    left.accountNo.localeCompare(right.accountNo, "de-CH", { numeric: true }),
  );
}

export function parseChartOfAccountsHeuristically(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const accounts: StructuredAccount[] = [];

  for (const line of lines) {
    const sanitized = line.replace(/\t+/g, " ").replace(/\s{2,}/g, " ");
    const match = sanitized.match(/^([.:,;]?[0-9A-Za-z-]{2,})\s+(.+)$/);

    if (!match) continue;

    accounts.push({
      accountNo: match[1],
      name: match[2],
      kind: inferAccountKind(match[1], match[2]),
      isActive: true,
    });
  }

  return normalizeAccounts(accounts);
}

export async function structureChartOfAccounts(input: {
  rawText: string;
  pdfBuffer?: Buffer | null;
  settings: LiteSettings;
}) {
  const fallback = parseChartOfAccountsHeuristically(input.rawText);

  if (!hasUsableAiConfig(input.settings)) {
    return {
      accounts: fallback,
      usedAi: false,
    };
  }

  try {
    const content: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text:
          "Strukturiere den Kontenplan fuer Banana/Buchhaltung. Antworte nur als JSON im Format " +
          '{"accounts":[{"accountNo":"4200","name":"Bueromaterial","kind":"expense","isActive":true}]}. ' +
          "Wenn etwas unklar ist, liefere trotzdem nur die bestmoeglichen Konten.",
      },
    ];

    if (input.rawText.trim()) {
      content.push({
        type: "text",
        text: `Kontenplan Rohtext:\n${input.rawText.slice(0, 15000)}`,
      });
    }

    if (input.pdfBuffer) {
      const document = await pdf(input.pdfBuffer, { scale: 2.2 });
      const maxPages = Math.min(document.length, 4);

      for (let index = 1; index <= maxPages; index += 1) {
        const buffer = await document.getPage(index);
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${buffer.toString("base64")}`,
          },
        });
      }
    }

    const result = await callAiJson<{ accounts?: StructuredAccount[] }>({
      settings: input.settings,
      content,
    });

    return {
      accounts: normalizeAccounts(result.accounts ?? fallback),
      usedAi: true,
    };
  } catch {
    return {
      accounts: fallback,
      usedAi: false,
    };
  }
}
