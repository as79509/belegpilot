import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    include: { company: { select: { id: true, name: true } } },
  });

  if (userCompanies.length <= 1) {
    return NextResponse.json({ companies: [] });
  }

  const companyIds = userCompanies.map((uc) => uc.companyId);

  const companies = await Promise.all(
    companyIds.map(async (cid) => {
      const company = userCompanies.find((uc) => uc.companyId === cid)!.company;

      const [statusCounts, lastDoc, bexioIntegration] = await Promise.all([
        prisma.document.groupBy({
          by: ["status"],
          where: { companyId: cid },
          _count: true,
        }),
        prisma.document.findFirst({
          where: { companyId: cid },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.integration.findFirst({
          where: { companyId: cid, providerType: "export", providerName: "bexio" },
          select: { isEnabled: true },
        }),
      ]);

      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of statusCounts) {
        counts[row.status] = row._count;
        total += row._count;
      }

      const ready = (counts.ready || 0) + (counts.exported || 0);

      return {
        id: cid,
        name: company.name,
        stats: {
          needs_review: counts.needs_review || 0,
          ready: counts.ready || 0,
          failed: counts.failed || 0,
          exported: counts.exported || 0,
          total,
        },
        progress: total > 0 ? Math.round((ready / total) * 100) : 0,
        lastUpload: lastDoc?.createdAt || null,
        bexioConfigured: bexioIntegration?.isEnabled || false,
      };
    })
  );

  return NextResponse.json({ companies });
}
