import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function POST() {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const templates = await prisma.recurringEntry.findMany({
      where: { companyId: ctx.companyId, isActive: true },
    });

    const now = new Date();
    let generated = 0;

    for (const t of templates) {
      if (t.endDate && now > t.endDate) continue;
      if (now < t.startDate) continue;

      // Check if already generated this period
      const lastGen = t.lastGeneratedAt;
      let shouldGenerate = false;

      if (!lastGen) {
        shouldGenerate = true;
      } else {
        const diffDays = (now.getTime() - lastGen.getTime()) / 86400000;
        if (t.frequency === "monthly" && diffDays >= 28) shouldGenerate = true;
        if (t.frequency === "quarterly" && diffDays >= 85) shouldGenerate = true;
        if (t.frequency === "yearly" && diffDays >= 360) shouldGenerate = true;
      }

      if (!shouldGenerate) continue;

      await prisma.journalEntry.create({
        data: {
          companyId: ctx.companyId,
          entryDate: now,
          debitAccount: t.debitAccount,
          creditAccount: t.creditAccount,
          amount: t.amount,
          currency: t.currency,
          vatAmount: t.vatAmount,
          description: `${t.name} (${t.frequency})`,
          entryType: "recurring",
          isRecurring: true,
          recurringId: t.id,
          createdBy: ctx.session.user.id,
        },
      });

      await prisma.recurringEntry.update({
        where: { id: t.id },
        data: { lastGeneratedAt: now },
      });

      generated++;
    }

    return NextResponse.json({ generated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
