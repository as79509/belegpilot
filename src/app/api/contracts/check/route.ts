import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const contracts = await prisma.contract.findMany({
    where: { companyId: ctx.companyId, status: { in: ["active", "expiring"] } },
  });

  const now = new Date();
  const results = [];

  for (const c of contracts) {
    // Calculate expected last invoice date
    let expectedDate: Date | null = null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (c.frequency === "monthly") {
      expectedDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    } else if (c.frequency === "quarterly") {
      const qMonth = Math.floor((today.getMonth() - 1) / 3) * 3;
      expectedDate = new Date(today.getFullYear(), qMonth, 1);
    } else if (c.frequency === "yearly") {
      expectedDate = new Date(today.getFullYear() - 1, c.startDate.getMonth(), 1);
    }

    // Search for matching document
    let invoiceStatus = "pending";
    let daysOverdue: number | undefined;

    if (expectedDate) {
      const periodEnd = new Date(expectedDate);
      if (c.frequency === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (c.frequency === "quarterly") periodEnd.setMonth(periodEnd.getMonth() + 3);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      const matchingDoc = await prisma.document.findFirst({
        where: {
          companyId: ctx.companyId,
          supplierNameNormalized: { contains: c.counterparty, mode: "insensitive" },
          invoiceDate: { gte: expectedDate, lt: periodEnd },
        },
      });

      if (matchingDoc) {
        invoiceStatus = "received";
      } else {
        const daysSince = Math.floor((now.getTime() - periodEnd.getTime()) / 86400000);
        if (daysSince > 5) {
          invoiceStatus = "overdue";
          daysOverdue = daysSince;
        }
      }
    }

    // Check if contract is expiring
    let expiringIn: number | undefined;
    if (c.endDate) {
      const daysToEnd = Math.floor((c.endDate.getTime() - now.getTime()) / 86400000);
      if (daysToEnd <= c.reminderDays && daysToEnd > 0) {
        expiringIn = daysToEnd;
      }
    }

    results.push({
      id: c.id,
      name: c.name,
      counterparty: c.counterparty,
      expectedDate,
      invoiceStatus,
      daysOverdue,
      expiringIn,
      contractStatus: c.status,
    });
  }

  const overdueCount = results.filter((r) => r.invoiceStatus === "overdue").length;
  const expiringCount = results.filter((r) => r.expiringIn != null).length;

  return NextResponse.json({ contracts: results, overdueCount, expiringCount });
}
