import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

interface SystemAlert {
  type: "error" | "warning" | "info";
  source: "bexio" | "ai" | "processing";
  message: string;
  count?: number;
}

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const companyId = ctx.companyId;
  const h24ago = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const h1ago = new Date(Date.now() - 60 * 60 * 1000);

  const alerts: SystemAlert[] = [];

  // Failed Bexio exports (24h)
  const failedExports = await prisma.exportRecord.count({
    where: { status: "failed", createdAt: { gte: h24ago }, document: { companyId } },
  });
  if (failedExports > 0) {
    alerts.push({
      type: "error",
      source: "bexio",
      message: `${failedExports} Bexio-Export(e) fehlgeschlagen (letzte 24h)`,
      count: failedExports,
    });
  }

  // Failed documents (24h)
  const failedDocs = await prisma.document.count({
    where: { companyId, status: "failed", updatedAt: { gte: h24ago } },
  });
  if (failedDocs > 0) {
    alerts.push({
      type: "error",
      source: "processing",
      message: `${failedDocs} Beleg(e) fehlgeschlagen (letzte 24h)`,
      count: failedDocs,
    });
  }

  // Stuck processing documents (>1h)
  const stuckDocs = await prisma.document.count({
    where: { companyId, status: "processing", updatedAt: { lt: h1ago } },
  });
  if (stuckDocs > 0) {
    alerts.push({
      type: "warning",
      source: "processing",
      message: `${stuckDocs} Beleg(e) hängen in der Verarbeitung`,
      count: stuckDocs,
    });
  }

  return NextResponse.json({ alerts });
}
