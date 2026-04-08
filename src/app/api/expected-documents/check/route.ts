import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const expectedDocs = await prisma.expectedDocument.findMany({
    where: { companyId, isActive: true },
  });

  const results: any[] = [];
  let received = 0;
  let missing = 0;
  let mismatch = 0;

  for (const ed of expectedDocs) {
    // Check if expected this month
    const isExpectedThisMonth = checkExpectedThisMonth(ed.frequency, month, ed.createdAt);
    if (!isExpectedThisMonth) {
      results.push({
        id: ed.id, name: ed.name, counterparty: ed.counterparty,
        expectedAmount: ed.expectedAmount, status: "not_expected",
        matchedDocumentId: null, actualAmount: null, deviation: null,
      });
      continue;
    }

    // Search for matching document
    const matchedDoc = await prisma.document.findFirst({
      where: {
        companyId,
        invoiceDate: { gte: monthStart, lt: monthEnd },
        OR: [
          { supplierNameNormalized: { contains: ed.counterparty, mode: "insensitive" } },
          { supplierNameRaw: { contains: ed.counterparty, mode: "insensitive" } },
        ],
      },
      select: { id: true, grossAmount: true },
      orderBy: { createdAt: "desc" },
    });

    if (!matchedDoc) {
      results.push({
        id: ed.id, name: ed.name, counterparty: ed.counterparty,
        expectedAmount: ed.expectedAmount, status: "missing",
        matchedDocumentId: null, actualAmount: null, deviation: null,
      });
      missing++;
      continue;
    }

    // Check amount tolerance
    const actualAmount = matchedDoc.grossAmount ? Number(matchedDoc.grossAmount) : null;
    let deviation: number | null = null;
    let status = "received";

    if (ed.expectedAmount && actualAmount != null) {
      const expected = Number(ed.expectedAmount);
      deviation = actualAmount - expected;
      const tolerance = (ed.tolerancePercent ?? 20) / 100;
      if (Math.abs(deviation) > expected * tolerance) {
        status = "amount_mismatch";
        mismatch++;
      } else {
        received++;
      }
    } else {
      received++;
    }

    results.push({
      id: ed.id, name: ed.name, counterparty: ed.counterparty,
      expectedAmount: ed.expectedAmount, status,
      matchedDocumentId: matchedDoc.id, actualAmount, deviation,
    });
  }

  return NextResponse.json({
    month, year,
    expected: results,
    summary: { total: results.filter((r) => r.status !== "not_expected").length, received, missing, mismatch },
  });
}

function checkExpectedThisMonth(frequency: string, month: number, createdAt: Date): boolean {
  if (frequency === "monthly") return true;
  if (frequency === "quarterly") {
    return month % 3 === 1; // Jan, Apr, Jul, Oct
  }
  if (frequency === "yearly") {
    return createdAt.getMonth() + 1 === month;
  }
  return true;
}
