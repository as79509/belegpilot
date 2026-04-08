import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    select: { companyId: true },
  });

  const companyIds = userCompanies.length > 0
    ? userCompanies.map((uc) => uc.companyId)
    : [session.user.companyId];

  const documents = await prisma.document.findMany({
    where: { companyId: { in: companyIds }, status: "needs_review" },
    include: {
      company: { select: { id: true, name: true } },
      file: { select: { fileName: true } },
    },
    orderBy: { confidenceScore: "asc" },
    take: 50,
  });

  // Count per company
  const companyCounts: Record<string, number> = {};
  for (const doc of documents) {
    companyCounts[doc.company.name] = (companyCounts[doc.company.name] || 0) + 1;
  }

  return NextResponse.json({
    documents,
    total: documents.length,
    companyCounts,
  });
}
