import { NextResponse } from "next/server";

import { ensureDatabase, prisma } from "@/lib/db";
import { deleteStoredFile } from "@/lib/storage";
import { parseAmountInput, parseDateInput } from "@/lib/utils";

function emptyToNull(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabase();
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return NextResponse.json({ error: "Beleg wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabase();
  const payload = (await request.json()) as Record<string, string>;
  const status = emptyToNull(payload.status);

  try {
    const document = await prisma.document.update({
      where: { id },
      data: {
        supplierName: emptyToNull(payload.supplierName),
        documentDate: parseDateInput(payload.documentDate),
        invoiceDate: parseDateInput(payload.invoiceDate),
        dueDate: parseDateInput(payload.dueDate),
        invoiceNumber: emptyToNull(payload.invoiceNumber),
        currency: emptyToNull(payload.currency)?.toUpperCase() ?? null,
        grossAmount: parseAmountInput(payload.grossAmount),
        taxHint: emptyToNull(payload.taxHint),
        description: emptyToNull(payload.description),
        confirmedExpenseAccountNo: emptyToNull(payload.confirmedExpenseAccountNo),
        creditAccountNo: emptyToNull(payload.creditAccountNo),
        status: status ? (status as "neu" | "gelesen" | "geprueft" | "exportiert") : undefined,
      },
    });

    return NextResponse.json({ document });
  } catch {
    return NextResponse.json({ error: "Beleg konnte nicht gespeichert werden." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabase();
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return NextResponse.json({ error: "Beleg wurde nicht gefunden." }, { status: 404 });
  }

  await deleteStoredFile(document.storedPath);
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
