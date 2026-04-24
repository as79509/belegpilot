import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabase, prisma } from "@/lib/db";

const accountSchema = z.object({
  accountNo: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    await ensureDatabase();
    const payload = accountSchema.parse(await request.json());
    const account = await prisma.account.upsert({
      where: {
        clientId_accountNo: {
          clientId: id,
          accountNo: payload.accountNo.trim(),
        },
      },
      update: {
        name: payload.name.trim(),
        kind: payload.kind.trim(),
        isActive: true,
      },
      create: {
        clientId: id,
        accountNo: payload.accountNo.trim(),
        name: payload.name.trim(),
        kind: payload.kind.trim(),
        isActive: true,
      },
    });

    return NextResponse.json({
      account: {
        accountNo: account.accountNo,
        name: account.name,
        kind: account.kind,
        isActive: account.isActive,
      },
    });
  } catch {
    return NextResponse.json({ error: "Konto konnte nicht gespeichert werden." }, { status: 400 });
  }
}
