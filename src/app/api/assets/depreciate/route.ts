import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST() {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const assets = await prisma.asset.findMany({
      where: { companyId: ctx.companyId, status: "active" },
    });

    let count = 0;
    let totalAmount = 0;

    for (const asset of assets) {
      const bv = Number(asset.bookValue);
      const rv = Number(asset.residualValue);
      if (bv <= rv) continue;

      let monthly: number;
      if (asset.depreciationMethod === "degressive" && asset.degressiveRate) {
        monthly = bv * (asset.degressiveRate / 100 / 12);
      } else {
        monthly = (Number(asset.acquisitionCost) - rv) / asset.usefulLifeMonths;
      }

      // Private use reduction for vehicles
      if (asset.category === "vehicles" && asset.privateUsePercent) {
        monthly *= 1 - asset.privateUsePercent / 100;
      }

      // Don't depreciate below residual value
      monthly = Math.min(monthly, bv - rv);
      monthly = Math.round(monthly * 100) / 100;
      if (monthly <= 0) continue;

      // Create journal entry
      await prisma.journalEntry.create({
        data: {
          companyId: ctx.companyId,
          entryDate: new Date(),
          debitAccount: asset.depreciationAccount,
          creditAccount: asset.assetAccount,
          amount: monthly,
          description: `Abschreibung: ${asset.name}`,
          entryType: "depreciation",
          createdBy: ctx.session.user.id,
        },
      });

      // Update asset
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          totalDepreciated: { increment: monthly },
          bookValue: { decrement: monthly },
        },
      });

      count++;
      totalAmount += monthly;
    }

    if (count > 0) {
      await logAudit({
        companyId: ctx.companyId, userId: ctx.session.user.id,
        action: "depreciation_generated", entityType: "asset", entityId: "batch",
        changes: { count: { before: null, after: count }, totalAmount: { before: null, after: Math.round(totalAmount * 100) / 100 } },
      });
    }

    return NextResponse.json({ depreciated: count, totalAmount: Math.round(totalAmount * 100) / 100 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
