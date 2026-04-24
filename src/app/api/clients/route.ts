import { NextResponse } from "next/server";
import { z } from "zod";

import { parseChartOfAccountsHeuristically } from "@/lib/chart-of-accounts";
import { ensureDatabase, prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { slugify } from "@/lib/utils";

const clientSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  companyName: z.string().optional().nullable(),
  uid: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).default("CHF"),
  defaultCreditAccount: z.string().min(1),
  defaultExpenseAccount: z.string().min(1),
  externalReferencePrefix: z.string().min(1),
  bookingMethodNote: z.string().optional().nullable(),
  chartOfAccountsRawText: z.string().optional().nullable(),
});

function emptyToNull(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

export async function GET() {
  await ensureDatabase();
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = clientSchema.parse(await request.json());
    const settings = await getAppSettings();
    const shortName = slugify(payload.shortName);
    const chartText = emptyToNull(payload.chartOfAccountsRawText);
    const accounts = chartText ? parseChartOfAccountsHeuristically(chartText) : [];

    const client = await prisma.client.create({
      data: {
        name: payload.name.trim(),
        shortName,
        companyName: emptyToNull(payload.companyName),
        uid: emptyToNull(payload.uid),
        currency: payload.currency.toUpperCase(),
        defaultCreditAccount: payload.defaultCreditAccount.trim(),
        defaultExpenseAccount: payload.defaultExpenseAccount.trim(),
        externalReferencePrefix:
          payload.externalReferencePrefix.trim().toUpperCase() ||
          settings.globalExternalReferencePrefix,
        bookingMethodNote: emptyToNull(payload.bookingMethodNote),
        chartOfAccountsRawText: chartText,
        accounts: {
          create: accounts,
        },
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Bitte alle Pflichtfelder für den Mandanten ausfüllen."
        : "Mandant konnte nicht angelegt werden.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
