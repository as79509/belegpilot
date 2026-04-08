import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

const VAT_RATES = [7.7, 8.1, 2.5, 3.7, 0];

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const quarter = parseInt(searchParams.get("quarter") || String(Math.ceil((now.getMonth() + 1) / 3)));

  if (quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: "Quartal muss zwischen 1 und 4 liegen" }, { status: 400 });
  }

  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 1);

  const documents = await prisma.document.findMany({
    where: {
      companyId,
      invoiceDate: { gte: startDate, lt: endDate },
      status: { notIn: ["failed", "rejected"] },
    },
    select: {
      netAmount: true,
      vatAmount: true,
      grossAmount: true,
      vatRatesDetected: true,
    },
  });

  const rateMap = new Map<number, { netAmount: number; vatAmount: number; grossAmount: number; documentCount: number }>();
  for (const rate of VAT_RATES) {
    rateMap.set(rate, { netAmount: 0, vatAmount: 0, grossAmount: 0, documentCount: 0 });
  }

  for (const doc of documents) {
    // Determine the primary VAT rate for this document
    let primaryRate = 0;
    if (doc.vatRatesDetected && Array.isArray(doc.vatRatesDetected)) {
      const rates = doc.vatRatesDetected as number[];
      if (rates.length > 0) primaryRate = rates[0];
    } else if (doc.vatAmount && doc.netAmount) {
      const calcRate = (Number(doc.vatAmount) / Number(doc.netAmount)) * 100;
      // Match to closest known rate
      let minDiff = Infinity;
      for (const rate of VAT_RATES) {
        const diff = Math.abs(calcRate - rate);
        if (diff < minDiff) { minDiff = diff; primaryRate = rate; }
      }
    }

    const bucket = rateMap.get(primaryRate) || rateMap.get(0)!;
    bucket.netAmount += Number(doc.netAmount || 0);
    bucket.vatAmount += Number(doc.vatAmount || 0);
    bucket.grossAmount += Number(doc.grossAmount || 0);
    bucket.documentCount += 1;
  }

  const rates = VAT_RATES.map((rate) => {
    const data = rateMap.get(rate)!;
    return {
      rate,
      rateLabel: rate === 0 ? "0%" : `${rate}%`,
      netAmount: Math.round(data.netAmount * 100) / 100,
      vatAmount: Math.round(data.vatAmount * 100) / 100,
      grossAmount: Math.round(data.grossAmount * 100) / 100,
      documentCount: data.documentCount,
    };
  });

  const total = {
    netAmount: Math.round(rates.reduce((s, r) => s + r.netAmount, 0) * 100) / 100,
    vatAmount: Math.round(rates.reduce((s, r) => s + r.vatAmount, 0) * 100) / 100,
    grossAmount: Math.round(rates.reduce((s, r) => s + r.grossAmount, 0) * 100) / 100,
    documentCount: rates.reduce((s, r) => s + r.documentCount, 0),
  };

  return NextResponse.json({
    rates,
    total,
    period: `Q${quarter} ${year}`,
  });
}
