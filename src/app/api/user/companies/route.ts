import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    include: { company: { select: { id: true, name: true, legalName: true, currency: true } } },
    orderBy: { isDefault: "desc" },
  });

  // If no UserCompany entries exist, return the user's primary company
  if (userCompanies.length === 0) {
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { id: true, name: true, legalName: true, currency: true },
    });
    return NextResponse.json({
      companies: company ? [{ companyId: company.id, role: session.user.role, isDefault: true, company }] : [],
      activeCompanyId: session.user.companyId,
    });
  }

  const defaultCompany = userCompanies.find((uc) => uc.isDefault);
  return NextResponse.json({
    companies: userCompanies.map((uc) => ({
      companyId: uc.companyId,
      role: uc.role,
      isDefault: uc.isDefault,
      company: uc.company,
    })),
    activeCompanyId: defaultCompany?.companyId || userCompanies[0].companyId,
  });
}
