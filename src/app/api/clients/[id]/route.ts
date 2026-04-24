import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabase, prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

const updateSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  companyName: z.string().optional(),
  uid: z.string().optional(),
  currency: z.string().min(3).max(3),
  defaultCreditAccount: z.string().min(1),
  defaultExpenseAccount: z.string().min(1),
  externalReferencePrefix: z.string().min(1),
  bookingMethodNote: z.string().optional(),
  chartOfAccountsRawText: z.string().optional(),
});

function emptyToNull(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    await ensureDatabase();
    const payload = updateSchema.parse(await request.json());

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: payload.name.trim(),
        shortName: slugify(payload.shortName),
        companyName: emptyToNull(payload.companyName),
        uid: emptyToNull(payload.uid),
        currency: payload.currency.toUpperCase(),
        defaultCreditAccount: payload.defaultCreditAccount.trim(),
        defaultExpenseAccount: payload.defaultExpenseAccount.trim(),
        externalReferencePrefix: payload.externalReferencePrefix.trim().toUpperCase(),
        bookingMethodNote: emptyToNull(payload.bookingMethodNote),
        chartOfAccountsRawText: payload.chartOfAccountsRawText ?? "",
      },
    });

    return NextResponse.json({ client });
  } catch {
    return NextResponse.json({ error: "Mandant konnte nicht gespeichert werden." }, { status: 400 });
  }
}
